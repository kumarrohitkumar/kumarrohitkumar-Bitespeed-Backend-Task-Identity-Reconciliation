import express from 'express';
import { AppDataSource } from './data-source';
import identifyRoutes from './routes/identify.routes';
import dotenv from 'dotenv';
import cors from 'cors';
import userRoutes from './routes/user.routes';
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
AppDataSource.initialize()
  .then(() => {
    console.log("Data Source has been initialized!");
    app.use('/', identifyRoutes); // All routes
    // app.use('/', userRoutes);
    app.use('/', userRoutes);
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => console.error("Error during Data Source initialization:", error));
