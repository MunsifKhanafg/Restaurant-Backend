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
        // generate a new billId and retry
        const ts  = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
        data.billId = `BILL-${ts}-${rnd}`;
        continue;
      }
      throw err; // give up or non-dup error
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

  /* ── basic validation ── */
  if (!orderType) {
    res.status(400);
    throw new Error('orderType is required (dine-in | takeaway | delivery)');
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Order must contain at least one item');
  }

  /* ── validate payment method ── */
  const VALID_METHODS = ['cash','card','online','cod','jazzcash','easypaisa','bankaccount'];
  if (!VALID_METHODS.includes(paymentMethod)) {
    res.status(400);
    throw new Error(`Invalid paymentMethod: ${paymentMethod}`);
  }

  /* ── enrich items + check stock ── */
  let subtotal = 0;
  const enrichedItems = [];
  const stockUpdates = []; // collect updates, apply after successful save

  for (const item of items) {
    if (!item.product) {
      res.status(400);
      throw new Error('Each item must have a product ID');
    }

    const product = await Product.findById(item.product);

    if (!product) {
      res.status(400);
      throw new Error(`Product not found: ${item.product}`);
    }
    if (!product.isAvailable) {
      res.status(400);
      throw new Error(`"${product.name}" is currently unavailable`);
    }
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

  /* ── calculate totals ── */
  const taxPercentage = num(process.env.TAX_PERCENTAGE, 8);
  const taxAmount     = parseFloat(((subtotal * taxPercentage) / 100).toFixed(2));
  const disc          = num(discountAmount);
  const delCharge     = num(deliveryCharge);
  const breadAmt      = breadIncluded ? num(breadCharge, 0) : 0;
  const totalAmount   = parseFloat((subtotal + taxAmount - disc + delCharge + breadAmt).toFixed(2));

  /* ── persist order (with billId duplicate retry) ── */
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

  /* ── deduct stock (only after successful save) ── */
  for (const { id, qty } of stockUpdates) {
    await Product.findByIdAndUpdate(id, {
      $inc: { currentStock: -qty, totalOrders: qty },
    });
  }

  /* ── populate waiter name for response ── */
  const populated = await Order.findById(order._id).populate('waiter', 'name');

  /* ── socket events ── */
  const io = req.app.get('io');
  if (io) {
    io.to('kitchen').emit('newOrder', populated);
    io.to('admin').emit('newOrder', populated);
  }

  res.status(201).json({ success: true, data: populated });
});

/* ════════════════════════════════════════════════════════
   GET /api/orders
════════════════════════════════════════════════════════ */
const getOrders = asyncHandler(async (req, res) => {
  const { status, orderStatus, type, orderType, tableNumber, date, limit = 50 } = req.query;
  const query = {};

  // Support both ?status= and ?orderStatus= (single or comma-separated)
  const statusVal = orderStatus || status;
  if (statusVal) {
    const statuses = statusVal.split(',').map(s => s.trim()).filter(Boolean);
    query.orderStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  // Support both ?type= and ?orderType=
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
    .limit(Math.min(parseInt(limit) || 50, 200));

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
    if (!VALID.includes(status)) {
      res.status(400);
      throw new Error(`Invalid status: ${status}`);
    }
    order.orderStatus = status;
    if (status === 'completed' || status === 'delivered') {
      order.completedAt  = new Date();
      order.paymentStatus = 'paid';
    }
    if (status === 'cancelled') {
      /* restore stock */
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { currentStock: item.quantity, totalOrders: -item.quantity },
        });
      }
    }
  }

  /* per-item kitchen status update */
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

module.exports = { createOrder, getOrders, getOrder, updateOrderStatus, getKitchenOrders };
