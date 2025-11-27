const express = require('express');
const router = express.Router();

// Rutas CRUD inventario
router.get('/', (req, res) => res.send('GET inventario'));
router.post('/', (req, res) => res.send('POST inventario'));
router.put('/:id', (req, res) => res.send('PUT inventario'));
router.delete('/:id', (req, res) => res.send('DELETE inventario'));

module.exports = router;
