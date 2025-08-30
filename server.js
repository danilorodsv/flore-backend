// Importação de Módulos
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// --- Configuração Inicial ---
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares Globais ---
app.use(cors());
app.use(express.json());
// Servir arquivos estáticos da pasta 'public' do frontend
app.use(express.static(path.join(__dirname, '..', 'flore frontend')));


// --- Configuração do Banco de Dados (LowDB) ---
const dataDir = join(__dirname, 'data');
const dbPath = join(dataDir, 'db.json');
const adapter = new JSONFile(dbPath);

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
        hours: 'Seg - Sex: 08:00 às 18:00\nSáb: 08:00 às 12:00',
        primaryColor: '#C4A484'
    },
    admin: {
        passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10)
    }
};
const db = new Low(adapter, defaultData);


// --- Middleware de Autenticação ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Token não fornecido' });

    jwt.verify(token, process.env.JWT_SECRET || 'seu-segredo-jwt-padrao', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
        req.user = user;
        next();
    });
};

// ==================================================
// --- ROTAS DA API ---
// ==================================================

// --- ROTAS PÚBLICAS (Não precisam de login) ---
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const passwordMatch = await bcrypt.compare(password, db.data.admin.passwordHash);
  if (passwordMatch) {
    const token = jwt.sign({ username: 'admin' }, process.env.JWT_SECRET || 'seu-segredo-jwt-padrao', { expiresIn: '8h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Senha incorreta' });
  }
});
app.get('/api/products', (req, res) => res.json(db.data.products.filter(p => p.active)));
app.get('/api/categories', (req, res) => res.json(db.data.categories));
app.get('/api/settings', (req, res) => res.json(db.data.settings));
app.post('/api/analytics', async (req, res) => {
    try {
        const event = { ...req.body, timestamp: new Date().toISOString(), id: uuidv4() };
        db.data.analytics.push(event);
        await db.write();
        res.status(201).send({ status: 'ok' });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// --- ROTAS PROTEGIDAS (Precisam de login/token) ---
const adminRouter = express.Router();
adminRouter.use(authenticateToken); // Aplica o middleware a todas as rotas abaixo

// Produtos (Admin)
adminRouter.get('/products', (req, res) => res.json(db.data.products));
// Adicione aqui as rotas POST, PUT, DELETE para produtos

// Categorias (Admin)
adminRouter.get('/categories', (req, res) => res.json(db.data.categories));
// Adicione aqui as rotas POST, PUT, DELETE para categorias

// Configurações (Admin)
adminRouter.post('/settings', async (req, res) => {
    db.data.settings = { ...db.data.settings, ...req.body };
    await db.write();
    res.status(200).json({ message: 'Configurações salvas!', settings: db.data.settings });
});

// Pedidos (Admin)
adminRouter.get('/orders', (req, res) => res.json(db.data.orders));

// Dashboard (Admin)
adminRouter.get('/analytics/dashboard', (req, res) => {
    // Lógica para agregar dados do dashboard
    res.json({
        totalRevenue: db.data.orders.reduce((sum, o) => sum + o.total, 0),
        totalOrders: db.data.orders.length,
        totalProducts: db.data.products.length,
        ordersByStatus: {},
        popularProducts: [],
        recentOrders: db.data.orders.slice(-5)
    });
});

// Usa o router com o prefixo /api/admin
app.use('/api/admin', adminRouter);


// --- Inicialização do Servidor ---
const startServer = async () => {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await db.read();
        if (!db.data || Object.keys(db.data).length === 0) {
            db.data = defaultData;
            await db.write();
            console.log('Banco de dados inicializado com dados padrão.');
        } else {
            console.log('Banco de dados carregado com sucesso.');
        }
        app.listen(PORT, () => {
            console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Falha ao iniciar o servidor:", error);
        process.exit(1);
    }
};

startServer();