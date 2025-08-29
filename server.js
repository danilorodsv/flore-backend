// Importação de Módulos
import express from 'express';
import cors from 'cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIGURAÇÃO DO BANCO DE DADOS ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data'); // Define o diretório 'data'
const file = join(dataDir, 'db.json'); // Define o caminho do arquivo dentro de 'data'

// Estrutura de dados padrão para o banco de dados
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
        passwordHash: '$2a$10$somethinghashed'
    }
};

// --- INICIALIZAÇÃO DO SERVIDOR ---
async function startServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.static('public')); // Para servir arquivos como admin.html, index.html, etc.

    // **A CORREÇÃO CRÍTICA ESTÁ AQUI**
    // Garante que o diretório 'data' exista antes de tentar ler/escrever nele.
    try {
        await fs.mkdir(dataDir, { recursive: true });
        console.log(`Diretório de dados verificado/criado em: ${dataDir}`);
    } catch (error) {
        console.error('ERRO FATAL: Não foi possível criar o diretório de dados.', error);
        process.exit(1); // Encerra o servidor se não conseguir criar a pasta.
    }

    const adapter = new JSONFile(file);
    const db = new Low(adapter, defaultData);

    await db.read();
    // Garante que o db tenha os dados padrão se o arquivo for criado vazio
    db.data ||= defaultData;
    await db.write();

    // --- ROTAS DA API ---

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


    // --- INICIAR O SERVIDOR ---
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`API pronta para receber requisições.`);
    });
}

startServer().catch(err => {
    console.error("Falha ao iniciar o servidor:", err);
});


