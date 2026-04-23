const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
require('dotenv').config();

const User        = require('./models/User');
const Bin         = require('./models/Bin');
const Reward      = require('./models/Reward');
const Transaction = require('./models/Transaction');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], methods: ['GET', 'POST', 'DELETE', 'PUT'] }
});

app.set('io', io);
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/scan',         require('./routes/scan'));
app.use('/api/deposit',      require('./routes/deposit'));
app.use('/api/register',     require('./routes/register'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/rewards',      require('./routes/rewards'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/student',      require('./routes/student'));

const { publicLeaderboard } = require('./routes/student');
app.get('/api/leaderboard', publicLeaderboard);
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Client disconnected:', socket.id));
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('[DB] MongoDB connected');
    await seedDefaultData();
    server.listen(process.env.PORT || 5000, () => {
      console.log('[Server] Running on port', process.env.PORT || 5000);
      console.log('[Server] Admin password:', process.env.ADMIN_PASSWORD);
    });
  })
  .catch(err => { console.error('[DB] Connection failed:', err.message); process.exit(1); });

async function seedDefaultData() {
  if (!await Bin.findById('BIN_1')) {
    await Bin.create({ _id: 'BIN_1', name: 'Dustbin-A', currentWeight: 0, maxCapacity: 5000, isFull: false });
    console.log('[Seed] Default bin created');
  }
  if (await Reward.countDocuments() === 0) {
    await Reward.insertMany([
      { name: 'Free Canteen Meal',    description: 'Redeem for 1 free canteen meal',         cost: 500, stock: -1 },
      { name: 'Stationery Kit',       description: 'Pen, pencil, eraser set',                 cost: 300, stock: 10 },
      { name: 'Extra Library Day',    description: '1 extra borrowing day for library books',  cost: 200, stock: -1 },
      { name: 'School Store Voucher', description: '₹50 voucher at the school store',          cost: 750, stock: 20 },
      { name: 'Eco Warrior Badge',    description: 'Digital badge + certificate',              cost: 100, stock: -1 }
    ]);
    console.log('[Seed] Default rewards created');
  }
  if (await User.countDocuments() === 0) {
    const fakeUsers = [
      { name: 'Sneha R',     rfid_uid: 'FAKE000001', pin: '0000', points: 2100, totalWaste: 1050 },
      { name: 'Karan M',     rfid_uid: 'FAKE000002', pin: '0000', points: 1850, totalWaste: 920  },
      { name: 'Divya S',     rfid_uid: 'FAKE000003', pin: '0000', points: 1600, totalWaste: 800  },
      { name: 'Aditya P',    rfid_uid: 'FAKE000004', pin: '0000', points: 1400, totalWaste: 700  },
      { name: 'Meera K',     rfid_uid: 'FAKE000005', pin: '0000', points: 1200, totalWaste: 650  },
      { name: 'Rohan V',     rfid_uid: 'FAKE000006', pin: '0000', points: 980,  totalWaste: 490  },
      { name: 'Ananya T',    rfid_uid: 'FAKE000007', pin: '0000', points: 820,  totalWaste: 410  },
      { name: 'Vikram N',    rfid_uid: 'FAKE000008', pin: '0000', points: 650,  totalWaste: 325  },
      { name: 'Pooja L',     rfid_uid: 'FAKE000009', pin: '0000', points: 500,  totalWaste: 250  },
      { name: 'Siddharth A', rfid_uid: 'FAKE000010', pin: '0000', points: 300,  totalWaste: 150  }
    ];
    await User.insertMany(fakeUsers);
    console.log('[Seed] Demo users created');

    const materials   = ['plastic', 'metal', 'paper', 'general'];
    const multipliers = { plastic: 2, metal: 3, paper: 1.5, general: 1 };
    const seededUsers = await User.find({ rfid_uid: /^FAKE/ });
    const fakeTx      = [];
    seededUsers.forEach(u => {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const mat      = materials[Math.floor(Math.random() * materials.length)];
        const wt       = 100 + Math.floor(Math.random() * 400);
        const pts      = Math.round(wt * multipliers[mat]);
        const hoursAgo = Math.floor(Math.random() * 72);
        fakeTx.push({ userId: u._id, userName: u.name, weight: wt, material: mat, points: pts, binId: 'BIN_1', timestamp: new Date(Date.now() - hoursAgo * 3600000) });
      }
    });
    await Transaction.insertMany(fakeTx);
    console.log('[Seed]', fakeTx.length, 'demo transactions created');
  }
}
