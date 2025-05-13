const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');


const app = express();
const PORT = 3003; // You used 3003, so we'll keep it


const session = require('express-session');

app.use(express.static(path.join(__dirname, '../mainPage')));

app.use(session({
  secret: 'yourSecretKey',        // replace with a strong secret in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30*1000 // 30 seconds (in milliseconds)
  }
}));
app.get('/setCookie', (req, res) => {
  res.cookie('userSession', 'abc123', { maxAge: 60000, httpOnly: true });
  res.send('Cookie has been set!');
});
app.get('/getCookie', (req, res) => {
  const userSession = req.cookies.userSession;
  res.send(`User session is: ${userSession}`);
});
app.get('/clearCookie', (req, res) => {
  res.clearCookie('userSession');
  res.send('Cookie cleared!');
});


// ✅ MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/userDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ User Schema
const userSchema = new mongoose.Schema({
  name: String,
  phone_number: String,
  email: String,
  password: String,
});

const User = mongoose.model('User', userSchema);

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static(__dirname)); // so styles.css and html load
app.use('/mainPage', express.static(path.join(__dirname, '../mainPage')));


// ✅ Signup Route
app.post('/signup', async (req, res) => {
  const { name, phone_number, email, password } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.send(`<script>alert("User already exists. Please login."); window.location.href='login.html';</script>`);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    name,
    phone_number,
    email,
    password: hashedPassword,
  });

  await newUser.save();
  return res.send(`<script>alert("Signup successful! Please login."); window.location.href='login.html';</script>`);
});

// ✅ Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.send(`<script>alert("User not found. Please sign up first."); window.location.href='signup.html';</script>`);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.send(`<script>alert("Incorrect password. Please try again."); window.location.href='login.html';</script>`);
  }

  
  req.session.user = {
    email: user.email,
    name: user.name
  };
  

  //  Redirect to main page
  return res.redirect('../mainPage/index.html');
});




// ✅ Optional homepage route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});


app.get('/mainPage/index.html', (req, res) => {
  if (!req.session.user) {
    return res.send(`<script>alert("⏳ Session expired. Please login again."); window.location.href='/login.html';</script>`);
  }
  res.sendFile(path.join(__dirname, 'mainPage', 'index.html'));
});


app.get('/mainPage/booking.html', (req, res) => {
  if (!req.session.user) {
    return res.send(`<script>alert("⏳ Session expired. Please login again."); window.location.href='/login.html';</script>`);
  }
  res.sendFile(path.join(__dirname, 'mainPage', 'booking.html'));
});


app.get('/check-session', (req, res) => {
  console.log("Session check hit. Session content:", req.session);
  if (req.session.user) {
    res.json({ active: true });
  } else {
    res.json({ active: false });
  }
});



// ✅ Booking Page Route (to serve booking.html directly if needed)
app.get('/booking', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, '../mainPage/booking.html'));
});


// ✅ Booking Schema (Define this inside server.js)
const bookingSchema = new mongoose.Schema({
  fullName: String,
  country: String,
  email: String,
  tourDescription: String,
  travelDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  numPersons: {
    type: Number,
    required: true,
    min: 1
  },
  contactNo: {
    type: Number,
    required: true
  }
});

const Booking = mongoose.model("Booking", bookingSchema);


// ✅ Booking Form Submission
app.post('/bookingPage', async (req, res) => {
  try {
    req.body.travelDate = new Date(req.body.travelDate);

    console.log("📩 Form data received:", req.body);
    const newBooking = new Booking(req.body);
    const saved = await newBooking.save();
    console.log("✔️ Booking saved:", saved);
    
    return res.json({ 
      success: true,
      message: "Booking successful",
      redirectUrl: "/mainPage/payment.html" // Explicit redirect URL
    });

    return res.redirect('/mainPage/payment.html');

  } catch (err) {
    console.error("❌ Error saving booking:", err.message);
    res.status(400).json({ success: false, message: "Unable to save booking" });
  }
});

const paymentSchema = new mongoose.Schema({
  pickupLocation: String,
  mobile: String,
  cardNumber: String,
  destination: String,
  days: Number,
  numPeople: Number,
  totalPrice: Number,
  passengers: [
    {
      name: String,
      age: Number
    }
  ]
});

const Payment = mongoose.model("Payment", paymentSchema);


app.post('/confirmBooking', async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.status(200).send("Tour confirmed!");
  } catch (err) {
    console.error("❌ Error confirming tour:", err.message);
    res.status(500).send("Something went wrong.");
  }
});


const reviewSchema = new mongoose.Schema({
  name: String,
  email: String,
  review: String,
  date: {
    type: Date,
    default: Date.now,
  },
});

const Review = mongoose.model('Review', reviewSchema); 

app.post('/submit-review', async (req, res) => {
  try {
    const { name, email, review } = req.body;

    if (!name || !email || !review) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const newReview = new Review({ name, email, review });
    await newReview.save();

    res.status(201).json({ message: 'Review submitted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});







app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}/login.html`);
});
