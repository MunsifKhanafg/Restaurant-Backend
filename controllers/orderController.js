const asyncHandler = require('express-async-handler');
const Order   = require('../models/Order');
const Product = require('../models/Product');

/* ─── helper: safe number parse ─── */
const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
};

/* ─── helper: retry order save on duplicate billId (extremely rare) ─── */
const saveOrderWithRetry = async (data, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await Order.create(data);
    } catch (err) {
      const isDup = err.code === 11000 && err.keyValue?.billId;
      if (isDup && attempt < maxRetries) {
        const ts  = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
        data.billId = `BILL-${ts}-${rnd}`;
        continue;
      }
      throw err;
    }
  }
};

/* ════════════════════════════════════════════════════════
   POST /api/orders — Create order
════════════════════════════════════════════════════════ */
const createOrder = asyncHandler(async (req, res) => {
  const {
    orderType,
    tableNumber,
    items,
    customer       = {},
    paymentMethod  = 'cash',
    paymentDetails = {},
    discountAmount,
    deliveryCharge,
    breadIncluded,
    breadCharge,
    notes,
  } = req.body;

  if (!orderType) {
    res.status(400);
    throw new Error('orderType is required (dine-in | takeaway | delivery)');
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Order must contain at least one item');
  }

  const VALID_METHODS = ['cash','card','online','cod','jazzcash','easypaisa','bankaccount'];
  if (!VALID_METHODS.includes(paymentMethod)) {
    res.status(400);
    throw new Error(`Invalid paymentMethod: ${paymentMethod}`);
  }

  let subtotal = 0;
  const enrichedItems = [];
  const stockUpdates  = [];

  for (const item of items) {
    if (!item.product) { res.status(400); throw new Error('Each item must have a product ID'); }
    const product = await Product.findById(item.product);
    if (!product) { res.status(400); throw new Error(`Product not found: ${item.product}`); }
    if (!product.isAvailable) { res.status(400); throw new Error(`"${product.name}" is currently unavailable`); }
    if (product.currentStock < item.quantity) {
      res.status(400);
      throw new Error(`"${product.name}" has only ${product.currentStock} in stock (requested ${item.quantity})`);
    }
    const qty = parseInt(item.quantity, 10) || 1;
    subtotal += product.price * qty;
    enrichedItems.push({
      product:             product._id,
      name:                product.name,
      price:               product.price,
      quantity:            qty,
      specialInstructions: item.specialInstructions || '',
    });
    stockUpdates.push({ id: product._id, qty });
  }

  const taxPercentage = num(process.env.TAX_PERCENTAGE, 8);
  const taxAmount     = parseFloat(((subtotal * taxPercentage) / 100).toFixed(2));
  const disc          = num(discountAmount);
  const delCharge     = num(deliveryCharge);
  const breadAmt      = breadIncluded ? num(breadCharge, 0) : 0;
  const totalAmount   = parseFloat((subtotal + taxAmount - disc + delCharge + breadAmt).toFixed(2));

  const orderData = {
    orderType,
    tableNumber: tableNumber || null,
    waiter:      req.user?._id || null,
    items:       enrichedItems,
    customer: {
      name:         customer.name         || '',
      phone:        customer.phone        || '',
      address:      customer.address      || '',
      deliveryZone: customer.deliveryZone || '',
    },
    subtotal,
    taxPercentage,
    taxAmount,
    discountAmount: disc,
    deliveryCharge: delCharge,
    breadIncluded:  !!breadIncluded,
    breadCharge:    breadAmt,
    totalAmount,
    paymentMethod,
    payRefNumber:   paymentDetails?.referenceNumber || '',
    paySenderName:  paymentDetails?.senderName      || '',
    notes:          notes || '',
  };

  const order = await saveOrderWithRetry(orderData);

  for (const { id, qty } of stockUpdates) {
    await Product.findByIdAndUpdate(id, {
      $inc: { currentStock: -qty, totalOrders: qty },
    });
  }

  const populated = await Order.findById(order._id).populate('waiter', 'name');

  const io = req.app.get('io');
  if (io) {
    io.to('kitchen').emit('newOrder', populated);
    io.to('admin').emit('newOrder', populated);
  }

  res.status(201).json({ success: true, data: populated });
});

/* ════════════════════════════════════════════════════════
   PUT /api/orders/:id/add-items
   Add new items to an existing confirmed/active order.
   Recalculates subtotal, tax, and totalAmount.
════════════════════════════════════════════════════════ */
const addItemsToOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('items array is required and must not be empty');
  }

  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }

  /* Only allow adding items to active orders */
  const ACTIVE_STATUSES = ['received', 'confirmed', 'preparing'];
  if (!ACTIVE_STATUSES.includes(order.orderStatus)) {
    res.status(400);
    throw new Error(`Cannot add items to an order with status "${order.orderStatus}". Order must be received, confirmed, or preparing.`);
  }

  const stockUpdates = [];

  for (const item of items) {
    if (!item.product) { res.status(400); throw new Error('Each item must have a product ID'); }

    const product = await Product.findById(item.product);
    if (!product) { res.status(400); throw new Error(`Product not found: ${item.product}`); }
    if (!product.isAvailable) { res.status(400); throw new Error(`"${product.name}" is currently unavailable`); }

    const qty = parseInt(item.quantity, 10) || 1;

    if (product.currentStock < qty) {
      res.status(400);
      throw new Error(`"${product.name}" has only ${product.currentStock} in stock (requested ${qty})`);
    }

    /* Check if this product already exists in the order — merge qty instead of duplicating */
    const existingIdx = order.items.findIndex(
      i => i.product.toString() === product._id.toString()
    );

    if (existingIdx !== -1) {
      order.items[existingIdx].quantity += qty;
    } else {
      order.items.push({
        product:             product._id,
        name:                product.name,
        price:               product.price,
        quantity:            qty,
        specialInstructions: item.specialInstructions || '',
        status:              'pending',
      });
    }

    stockUpdates.push({ id: product._id, qty });
  }

  /* Recalculate totals */
  const newSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const newTax      = parseFloat(((newSubtotal * order.taxPercentage) / 100).toFixed(2));
  const newTotal    = parseFloat(
    (newSubtotal + newTax - order.discountAmount + order.deliveryCharge + order.breadCharge).toFixed(2)
  );

  order.subtotal    = newSubtotal;
  order.taxAmount   = newTax;
  order.totalAmount = newTotal;

  /* Mark order status back to received so kitchen sees the new items */
  if (order.orderStatus === 'confirmed' || order.orderStatus === 'preparing') {
    order.orderStatus = 'received';
  }

  await order.save();

  /* Deduct stock */
  for (const { id, qty } of stockUpdates) {
    await Product.findByIdAndUpdate(id, {
      $inc: { currentStock: -qty, totalOrders: qty },
    });
  }

  const populated = await Order.findById(order._id).populate('waiter', 'name');

  /* Notify kitchen & admin about updated order */
  const io = req.app.get('io');
  if (io) {
    io.to('kitchen').emit('newOrder',    populated);  // re-emit so KDS refreshes
    io.to('admin').emit('newOrder',      populated);
    io.emit('orderStatusUpdate', { orderId: order._id, status: order.orderStatus, order: populated });
  }

  res.json({ success: true, data: populated });
});

/* ════════════════════════════════════════════════════════
   PUT /api/orders/:id/switch-table
   Switch a dine-in order from one table to another.
   - Validates the new table isn't occupied by a different active order
   - Updates the order's tableNumber
   - Socket emits so the table list refreshes everywhere
════════════════════════════════════════════════════════ */
const switchTable = asyncHandler(async (req, res) => {
  const { newTableNumber } = req.body;

  if (!newTableNumber || isNaN(parseInt(newTableNumber))) {
    res.status(400);
    throw new Error('newTableNumber is required and must be a number');
  }

  const newTable = parseInt(newTableNumber);
  const order    = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }

  if (order.orderType !== 'dine-in') {
    res.status(400);
    throw new Error('Only dine-in orders can switch tables');
  }

  const ACTIVE_STATUSES = ['received', 'confirmed', 'preparing', 'ready'];
  if (!ACTIVE_STATUSES.includes(order.orderStatus)) {
    res.status(400);
    throw new Error(`Cannot switch table for an order with status "${order.orderStatus}"`);
  }

  const oldTable = order.tableNumber;

  /* Check if the new table is already occupied by a DIFFERENT active order */
  if (newTable !== oldTable) {
    const conflict = await Order.findOne({
      _id:         { $ne: order._id },   // not this order
      tableNumber: newTable,
      orderType:   'dine-in',
      orderStatus: { $in: ACTIVE_STATUSES },
    });

    if (conflict) {
      res.status(409);
      throw new Error(`Table ${newTable} is already occupied (Order ${conflict.billId}). Please choose a different table.`);
    }
  }

  /* Apply the switch */
  order.tableNumber = newTable;
  await order.save();

  const populated = await Order.findById(order._id).populate('waiter', 'name');

  /* Notify all clients so occupied-table lists refresh instantly */
  const io = req.app.get('io');
  if (io) {
    io.emit('tableSwitched', {
      orderId:     order._id,
      oldTable,
      newTable,
      order:       populated,
    });
    /* Also send a generic status update so any listener that watches orderStatusUpdate also refreshes */
    io.emit('orderStatusUpdate', { orderId: order._id, status: order.orderStatus, order: populated });
  }

  res.json({ success: true, data: populated, oldTable, newTable });
});

/* ════════════════════════════════════════════════════════
   GET /api/orders
════════════════════════════════════════════════════════ */
const getOrders = asyncHandler(async (req, res) => {
  const { status, orderStatus, type, orderType, tableNumber, date, limit = 50 } = req.query;
  const query = {};

  const statusVal = orderStatus || status;
  if (statusVal) {
    const statuses = statusVal.split(',').map(s => s.trim()).filter(Boolean);
    query.orderStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  const typeVal = orderType || type;
  if (typeVal) query.orderType = typeVal;
  if (tableNumber) query.tableNumber = parseInt(tableNumber) || tableNumber;
  if (date) {
    const d = new Date(date);
    if (!isNaN(d)) {
      query.createdAt = { $gte: d, $lt: new Date(d.getTime() + 86_400_000) };
    }
  }
  const orders = await Order.find(query)
    .populate('waiter', 'name')
    .populate('driver', 'name phone')
    .sort('-createdAt')
    .limit(Math.min(parseInt(limit) || 50, 2000));

  res.json({ success: true, count: orders.length, data: orders });
});

/* ════════════════════════════════════════════════════════
   GET /api/orders/:id
════════════════════════════════════════════════════════ */
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('waiter', 'name')
    .populate('driver', 'name phone');
  if (!order) { res.status(404); throw new Error('Order not found'); }
  res.json({ success: true, data: order });
});

/* ════════════════════════════════════════════════════════
   PUT /api/orders/:id/status
════════════════════════════════════════════════════════ */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, itemId, itemStatus } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }

  if (status) {
    const VALID = ['received','confirmed','preparing','ready','delivered','completed','cancelled'];
    if (!VALID.includes(status)) { res.status(400); throw new Error(`Invalid status: ${status}`); }
    order.orderStatus = status;
    if (status === 'completed' || status === 'delivered') {
      order.completedAt   = new Date();
      order.paymentStatus = 'paid';
    }
    if (status === 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { currentStock: item.quantity, totalOrders: -item.quantity },
        });
      }
    }
  }

  if (itemId && itemStatus) {
    const item = order.items.id(itemId);
    if (item) item.status = itemStatus;
  }

  await order.save();

  const io = req.app.get('io');
  if (io) {
    io.emit('orderStatusUpdate', { orderId: order._id, status: order.orderStatus, order });
  }

  res.json({ success: true, data: order });
});

/* ════════════════════════════════════════════════════════
   GET /api/orders/kitchen
════════════════════════════════════════════════════════ */
const getKitchenOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    orderStatus: { $in: ['received', 'confirmed', 'preparing'] },
  }).sort('createdAt');
  res.json({ success: true, data: orders });
});

/* ════════════════════════════════════════════════════════
   DELETE /api/orders/clear-month  — Admin only
════════════════════════════════════════════════════════ */
const clearMonthOrders = asyncHandler(async (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) { res.status(400); throw new Error('year and month are required'); }
  const y  = parseInt(year);
  const m  = parseInt(month) - 1;
  const from = new Date(y, m, 1);
  const to   = new Date(y, m + 1, 1);
  const result = await Order.deleteMany({ createdAt: { $gte: from, $lt: to } });
  res.json({
    success: true, deleted: result.deletedCount,
    message: `Deleted ${result.deletedCount} orders from ${from.toLocaleString('default', { month: 'long' })} ${y}`,
  });
});

module.exports = {
  createOrder,
  addItemsToOrder,
  switchTable,
  getOrders,
  getOrder,
  updateOrderStatus,
  getKitchenOrders,
  clearMonthOrders,
};
