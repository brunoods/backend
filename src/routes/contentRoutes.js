const express = require('express');
const router = express.Router();
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Rota Quiz
router.get('/quiz/random', asyncHandler(async (req, res) => {
    const [rows] = await db.execute('SELECT * FROM quizzes WHERE is_active = 1 ORDER BY RAND() LIMIT 1');
    if (rows.length === 0) return res.status(404).json({ message: 'Sem perguntas.' });
    const q = rows[0];
    if (typeof q.opcoes === 'string') q.opcoes = JSON.parse(q.opcoes);
    res.json(q);
}));

// Rota Penalidades
router.get('/punishments', asyncHandler(async (req, res) => {
    const [rows] = await db.execute('SELECT * FROM punishment_templates');
    res.json(rows);
}));

// Rota Temas
router.get('/themes', asyncHandler(async (req, res) => {
    const [rows] = await db.execute('SELECT * FROM room_themes WHERE is_active = 1');
    const themes = rows.map(t => ({
        ...t,
        widgets: typeof t.widgets === 'string' ? JSON.parse(t.widgets) : t.widgets
    }));
    res.json(themes);
}));

// Rota Config
router.get('/config', asyncHandler(async (req, res) => {
    const [rows] = await db.execute('SELECT * FROM game_config');
    const configMap = {};
    rows.forEach(row => {
        configMap[row.config_key] = isNaN(row.value) ? row.value : parseFloat(row.value);
    });
    res.json(configMap);
}));

module.exports = router; // <--- O erro acontece se isto faltar!