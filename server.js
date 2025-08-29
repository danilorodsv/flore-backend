// Importação de Módulos
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuração Inicial ---
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Configuração do Banco de Dados (LowDB)
const dbPath = path.join(__dirname, 'data', 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {});

// --- Dados Padrão (Default Data) ---
const defaultData = {
  products: [
    { id: '1', name: 'Buquê de Rosas Vermelhas', description: 'Elegante buquê com 12 rosas vermelhas frescas, perfeito para demonstrar amor e carinho.', price: 89.9, category: 'buques', imageUrl: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&h=300&fit=crop', featured: true, views: 156, tags: ['romântico', 'clássico', 'vermelho'], active: true },
    { id: '2', name: 'Arranjo de Girassóis', description: 'Arranjo vibrante com girassóis frescos que trazem alegria e energia positiva.', price: 65.0, category: 'arranjos', imageUrl: 'https://images.unsplash.com/photo-1471194402529-8e0f5a675de6?w=400&h=300&fit=crop', featured: false, views: 189, tags: ['alegre', 'amarelo', 'energia'], active: true }
  ],
  categories: [
    { id: 'buques', name: 'Buquês', description: 'Buquês elegantes para todas as ocasiões' },
    { id: 'arranjos', name: 'Arranjos', description: 'Arranjos florais únicos e criativos' }
  ],
  orders: [],
  analytics: [],
  settings: {
    siteName: 'Florê',
    siteTagline: 'PREMIUM COLLECTION',
    heroTitle: 'Flores que encantam, momentos que marcam.',
    heroSubtitle: 'Arranjos feitos à mão com as flores mais frescas para celebrar a vida.',
    whatsapp: '5564999999999',
    address: 'Av. Hermógenes Coelho, 812 - Centro\nSão Luís de Montes Belos - GO',
    hours: 'Seg - Sex: 08:00 às 18:00\nSáb: 08:00 às 12:00'
  },
  admin: {
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10)
  }
};

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// Middleware de Autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ROTA DE HEALTH CHECK ---
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend da Florê está no ar!',
    timestamp: new Date().toISOString() 
  });
});

// --- Rotas da API ---

// ROTA PÚBLICA: Login do Admin
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const passwordMatch = await bcrypt.compare(password, db.data.admin.passwordHash);
  if (passwordMatch) {
    const token = jwt.sign({ username: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Senha incorreta' });
  }
});

// ROTAS PÚBLICAS: Catálogo
app.get('/api/products', (req, res) => res.json(db.data.products.filter(p => p.active)));
app.get('/api/categories', (req, res) => res.json(db.data.categories));
app.get('/api/settings', (req, res) => res.json(db.data.settings));

// ROTA PÚBLICA: Analytics (O TRECHO FALTANTE)
app.post('/api/analytics', async (req, res) => {
  try {
    const event = {
      ...req.body,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };
    if (!db.data.analytics) {
      db.data.analytics = [];
    }
    db.data.analytics.push(event);
    await db.write();
    res.status(201).send({ status: 'ok' });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});


// ... (O restante do seu código de API continua aqui)


// --- Inicialização do Servidor ---
const startServer = async () => {
    await db.read();
    if (!db.data || Object.keys(db.data).length === 0) {
        db.data = defaultData;
        await db.write();
        console.log('Banco de dados inicializado com dados padrão.');
    }
    app.listen(PORT, () => {
        console.log(`🚀 Servidor backend rodando em http://localhost:${PORT}`);
    });
};

startServer();

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname)));

// Rota para o index.html
app.get("/",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

// Rota para o admin.html
app.get("/admin.html",(req,res)=>{
  res.sendFile(path.join(__dirname,"admin.html"));
});


