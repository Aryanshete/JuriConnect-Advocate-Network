// server.js (improved safe email handling)
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const session = require('express-session');
const crypto = require('crypto');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');

const app = express();
const port = 3000;

// Static directories
app.use(express.static('public'));
app.use(express.static('uploads'));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/legalServiceRegistration', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// ----------------- Schemas ------------------
const legalServiceSchema = new mongoose.Schema({
    name: String,
    address: String,
    fieldOfExpertise: String,
    experienceInYears: Number,
    languages: String,
    about: String,
    phone: Number,
    email: String,
    enrollment: String,
    courts: String,
    isVerified: Boolean,
    documents: String,
    image: String,
    avgRating: String
});
const LegalService = mongoose.model('LegalService', legalServiceSchema);

const documentWriterSchema = new mongoose.Schema({
    name: String,
    address: String,
    fieldOfExpertise: String,
    experienceInYears: Number,
    languages: String,
    about: String,
    phone: Number,
    email: String,
    isVerified: Boolean,
    documents: String,
    image: String,
    avgRating: String
});
const DocumentWriter = mongoose.model('DocumentWriter', documentWriterSchema);

const userSchema = new mongoose.Schema({
    username: String,
    contact: String,
    email: String,
    password: String,
    verificationToken: String,
    isVerified: { type: Boolean, default: false }
});
const User = mongoose.model('Users', userSchema);

const ratingSchema = new mongoose.Schema({
    name: String,
    rating: String,
    comment: String,
    lawyerId: String
});
const Rating = mongoose.model('Ratings', ratingSchema);

// ----------------- Multer ------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// ----------------- Brevo SMTP Transporter ------------------
// Use env variable if present (safer). Otherwise fallback to hard-coded string.
function getTransporter() {
    
    return nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
           pass: process.env.SMTP_PASS
        }
    });
}

// ----------------- Middleware ------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // allow JSON bodies too

// ----------------- Serve Pages ------------------
app.get('/lawyerDetails', (req, res) => res.sendFile(__dirname + '/public/lawyerDetails.html'));
app.get('/registration', (req, res) => res.sendFile(__dirname + '/public/registration_form.html'));
app.get('/registerasdocumentwriter', (req, res) => res.sendFile(__dirname + '/public/registerasdocumentwriter.html'));
app.get('/feedback', (req, res) => res.sendFile(__dirname + '/public/feedback_form.html'));

// ---------------------- EMAIL ROUTES -------------------------

// Helper to send mail safely and return a result object
async function safeSendMail(transporter, mailOptions) {
    try {
        const info = await transporter.sendMail(mailOptions);
        return { ok: true, info };
    } catch (err) {
        console.error('sendMail error:', err && err.toString ? err.toString() : err);
        return { ok: false, error: err };
    }
}

// Feedback
app.post('/submit_feedback', async (req, res) => {
    const { name, email, feedback } = req.body;
    const transporter = getTransporter();

    const mailOptions = {
        from: "aryanshete009@gmail.com",
        to: email,
        subject: "Feedback Received",
        text: `Dear ${name},

Thank you for your feedback:
${feedback}

- Legal Service Team`
    };

    const result = await safeSendMail(transporter, mailOptions);
    if (!result.ok) return res.status(500).send('Error sending confirmation email.');
    res.send('Feedback submitted successfully.');
});

// Home contact
app.post('/home_contact', async (req, res) => {
    const { name, email, subject, message } = req.body;
    const transporter = getTransporter();

    const mailOptions = {
        from: "aryanshete009@gmail.com",
        to: email,
        subject: "Message Received",
        text: `Dear ${name},

We have received your message:

Subject: ${subject}
Message: ${message}

- Legal Service Team`
    };

    const result = await safeSendMail(transporter, mailOptions);
    if (!result.ok) return res.status(500).send('Error sending email.');
    res.send('Message sent successfully.');
});

// Inquiry
app.post('/submit-inquiry', async (req, res) => {
    const { name, contactNo, email, city, reason, lawyerId } = req.body;

    try {
        const lawyer = await LegalService.findById(lawyerId);
        if (!lawyer) return res.status(400).send("Lawyer not found");

        const transporter = getTransporter();

        const mailToClient = {
            from: "aryanshete009@gmail.com",
            to: email,
            subject: "Inquiry Received @ Legal Service",
            text: `Dear ${name},

Your inquiry has been received:

Reason: ${reason}
City: ${city}
Lawyer: ${lawyer.name}
Lawyer Contact: ${lawyer.phone}

- Legal Service Team`
        };

        const mailToLawyer = {
            from: "aryanshete009@gmail.com",
            to: lawyer.email,
            subject: "New Inquiry on Your Profile",
            text: `Dear ${lawyer.name},

A new inquiry has been submitted:

Name: ${name}
City: ${city}
Email: ${email}
Contact: ${contactNo}
Reason: ${reason}

- Legal Service Team`
        };

        const r1 = await safeSendMail(transporter, mailToClient);
        const r2 = await safeSendMail(transporter, mailToLawyer);

        if (!r1.ok || !r2.ok) {
            // If either failed, return 500 but keep record consistent
            return res.status(500).send('Error sending confirmation email.');
        }
        res.send("Inquiry submitted successfully.");
    } catch (err) {
        console.error('submit-inquiry error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// ---------------------- ADVOCATE REGISTRATION ---------------------
app.post('/register', upload.fields([{ name: 'documents' }, { name: 'image' }]), async (req, res) => {
    try {
        const {
            name,
            address,
            fieldOfExpertise,
            experienceInYears,
            languages,
            about,
            phone,
            email,
            enrollment,
            courts
        } = req.body;

        // SAFELY access files
        const imageFile = req.files && req.files["image"] && req.files["image"][0];
        const documentsFile = req.files && req.files["documents"] && req.files["documents"][0];

        const image = imageFile ? imageFile.filename : undefined;
        const documents = documentsFile ? documentsFile.filename : undefined;

        const legalService = new LegalService({
            name,
            address,
            fieldOfExpertise,
            experienceInYears,
            isVerified: false,
            documents,
            image,
            languages,
            about,
            phone,
            email,
            enrollment,
            courts
        });

        await legalService.save();
        res.send('Registration successful');
    } catch (error) {
        console.error('register error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ---------------------- DOCUMENT WRITER REGISTRATION ---------------------
app.post('/registerasdocumentwriter', upload.fields([{ name: 'documents' }, { name: 'image' }]), async (req, res) => {
    try {
        const {
            name,
            address,
            fieldOfExpertise,
            experienceInYears,
            languages,
            about,
            phone,
            email
        } = req.body;

        const imageFile = req.files && req.files["image"] && req.files["image"][0];
        const documentsFile = req.files && req.files["documents"] && req.files["documents"][0];

        const image = imageFile ? imageFile.filename : undefined;
        const documents = documentsFile ? documentsFile.filename : undefined;

        const documentWriter = new DocumentWriter({
            name,
            address,
            fieldOfExpertise,
            experienceInYears,
            isVerified: false,
            documents,
            image,
            languages,
            about,
            phone,
            email
        });

        await documentWriter.save();
        res.send('You have successfully registered');
    } catch (error) {
        console.error('registerasdocumentwriter error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ---------------------- GET LAWYERS ---------------------
app.get('/get-lawyers', async (req, res) => {
    try {
        const lawyers = await LegalService.find({ isVerified: true }).lean();
        const lawyerIds = lawyers.map(l => String(l._id));
        const ratings = await Rating.find({ lawyerId: { $in: lawyerIds } });

        // compute avg
        const avgMap = {};
        ratings.forEach(r => {
            const id = String(r.lawyerId);
            avgMap[id] = avgMap[id] || { sum: 0, count: 0 };
            avgMap[id].sum += Number(r.rating) || 0;
            avgMap[id].count += 1;
        });

        const result = lawyers.map(l => {
            const id = String(l._id);
            const avg = avgMap[id] ? (avgMap[id].sum / avgMap[id].count) : 0;
            return { ...l, avgRating: avg };
        });

        res.send(result);
    } catch (error) {
        console.error('get-lawyers error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Get single lawyer
app.get('/get-lawyer', (req, res) => {
    const { lawyerId } = req.query;
    LegalService.findById(lawyerId).then((lawyer) => {
        if (lawyer) res.send(lawyer);
        else res.status(400).send('Lawyer not found');
    }).catch(err => {
        console.error('get-lawyer error:', err);
        res.status(500).send('Internal Server Error');
    });
});

// ---------------------- GET DOCUMENT WRITERS ---------------------
app.get('/get-documentwriters', async (req, res) => {
    try {
        const writers = await DocumentWriter.find({ isVerified: true }).lean();
        const writerIds = writers.map(w => String(w._id));
        const ratings = await Rating.find({ lawyerId: { $in: writerIds } });

        const avgMap = {};
        ratings.forEach(r => {
            const id = String(r.lawyerId);
            avgMap[id] = avgMap[id] || { sum: 0, count: 0 };
            avgMap[id].sum += Number(r.rating) || 0;
            avgMap[id].count += 1;
        });

        const result = writers.map(w => {
            const id = String(w._id);
            const avg = avgMap[id] ? (avgMap[id].sum / avgMap[id].count) : 0;
            return { ...w, avgRating: avg };
        });

        res.send(result);
    } catch (error) {
        console.error('get-documentwriters error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Get single document writer
app.get('/get-documentwriter', (req, res) => {
    const { writerId } = req.query;
    DocumentWriter.findById(writerId).then((writer) => {
        if (writer) res.send(writer);
        else res.status(400).send('Document writer not found');
    }).catch(err => {
        console.error('get-documentwriter error:', err);
        res.status(500).send('Internal Server Error');
    });
});

// ---------------------- USER REGISTER ---------------------
app.post('/user-register', async (req, res) => {
    try {
        const { username, contact, email, password } = req.body;

        if (await User.findOne({ username })) return res.status(400).send('Username already exists.');
        if (await User.findOne({ email })) return res.status(400).send('Email already exists.');

        const verificationToken = crypto.randomBytes(20).toString('hex');
        await new User({ username, contact, email, password, verificationToken }).save();

        const transporter = getTransporter();
        const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;

        const mailOptions = {
            from: "aryanshete009@gmail.com",
            to: email,
            subject: "Email Verification",
            html: `
                <p>Click the link below to verify your email:</p>
                <p><a href="${verificationLink}" target="_blank">Verify Email</a></p>
                <p>If the link does not work, copy and paste this URL:</p>
                <p>${verificationLink}</p>
            `
        };

        const result = await safeSendMail(transporter, mailOptions);

        if (!result.ok) {
            console.warn('Verification email failed:', result.error);
            return res.status(500).send("Registration successful BUT failed to send verification email.");
        }

        res.send("Registration successful! Please check your email.");

    } catch (error) {
        console.error('user-register error:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Verify email
app.get('/verify-email', async (req, res) => {
    try {
        const user = await User.findOne({ verificationToken: req.query.token });
        if (!user) return res.status(400).send('Invalid or expired verification token');

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();
        res.send('Email verification successful. You can now login.');
    } catch (err) {
        console.error('verify-email error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// ---------------------- USER LOGIN ---------------------
app.post('/user-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).send('User not found');
        if (!user.isVerified) return res.status(401).send('Please verify your email before logging in.');
        if (user.password !== password) return res.status(401).send('Password is incorrect');
        res.send(user);
    } catch (err) {
        console.error('user-login error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// ---------------------- RATINGS ---------------------
app.post('/add-ratings', async (req, res) => {
    try {
        await new Rating(req.body).save();
        res.send('Rating successful');
    } catch (err) {
        console.error('add-ratings error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/get-ratings', (req, res) => {
    Rating.find({ lawyerId: req.query.lawyerId }).then((ratings) => {
        if (ratings) res.send(ratings);
        else res.status(400).send('Ratings not found');
    }).catch(err => {
        console.error('get-ratings error:', err);
        res.status(500).send('Internal Server Error');
    });
});

// ---------------------- START SERVER ---------------------
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
