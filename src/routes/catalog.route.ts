import express from 'express';
import { getCatalogExplore } from '../controllers/catalog.controller';

const router = express.Router();

router.get('/explore', getCatalogExplore);

export default router;
