import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.resolve('hotel.db');
const dbInstance = new Database(DB_PATH);

// Tipos
export interface Room {
    id: string;
    subtitle: string;
    title: string;
    price: number;
    status: 'libre' | 'ocupado' | 'limpieza' | 'reservado' | 'mantenimiento';
    features: string; // Guardado como JSON string en SQLite
    images: string;   // Guardado como JSON string en SQLite
    reverse: number;  // Booleano (0 o 1)
}

export interface Transaction {
    id: string;
    orderId: string;
    roomName: string;
    amount: number;
    customer: string;
    status: 'PENDIENTE' | 'EXITOSO' | 'FALLIDO' | 'CANCELADO' | 'INICIADO';
    timestamp: string;
    detail?: string;  // JSON string
}

// Inicialización de Tablas
dbInstance.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    subtitle TEXT,
    title TEXT,
    price REAL,
    status TEXT,
    features TEXT,
    images TEXT,
    reverse INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    roomName TEXT,
    amount REAL,
    customer TEXT,
    status TEXT,
    timestamp TEXT,
    detail TEXT
  );
`);

// Lógica de Migración (Solo si las tablas están vacías)
const migrateInitialData = () => {
    const roomCount = dbInstance.prepare('SELECT count(*) as count FROM rooms').get() as { count: number };

    if (roomCount.count === 0) {
        console.log("🚚 Migrando datos desde JSON a SQLite...");

        // Migrar Habitaciones
        const roomsJsonPath = path.resolve('src/data/rooms.json');
        if (fs.existsSync(roomsJsonPath)) {
            const rooms = JSON.parse(fs.readFileSync(roomsJsonPath, 'utf-8'));
            const insertRoom = dbInstance.prepare(`
        INSERT INTO rooms (id, subtitle, title, price, status, features, images, reverse)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

            for (const room of rooms) {
                insertRoom.run(
                    room.id,
                    room.subtitle,
                    room.title,
                    room.price,
                    room.status,
                    JSON.stringify(room.features),
                    JSON.stringify(room.images),
                    room.reverse ? 1 : 0
                );
            }
        }

        // Migrar Transacciones
        const txJsonPath = path.resolve('src/data/transactions.json');
        if (fs.existsSync(txJsonPath)) {
            const txs = JSON.parse(fs.readFileSync(txJsonPath, 'utf-8'));
            const insertTx = dbInstance.prepare(`
        INSERT INTO transactions (id, orderId, roomName, amount, customer, status, timestamp, detail)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

            for (const tx of txs) {
                insertTx.run(
                    tx.id,
                    tx.orderId,
                    tx.roomName,
                    tx.amount,
                    tx.customer,
                    tx.status,
                    tx.timestamp,
                    tx.detail ? JSON.stringify(tx.detail) : null
                );
            }
        }
        console.log("✅ Migración completada.");
    }
};

migrateInitialData();

export const db = {
    getRooms: () => {
        const rows = dbInstance.prepare('SELECT * FROM rooms').all() as any[];
        return rows.map(r => ({
            ...r,
            features: JSON.parse(r.features),
            images: JSON.parse(r.images),
            reverse: !!r.reverse
        }));
    },

    updateRoomStatus: (id: string, status: string) => {
        const result = dbInstance.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(status, id);
        return result.changes > 0;
    },

    updateRoomPrice: (id: string, price: number) => {
        const result = dbInstance.prepare('UPDATE rooms SET price = ? WHERE id = ?').run(price, id);
        return result.changes > 0;
    },

    getTransactions: () => {
        const rows = dbInstance.prepare('SELECT * FROM transactions ORDER BY timestamp DESC').all() as any[];
        return rows.map(r => ({
            ...r,
            detail: r.detail ? JSON.parse(r.detail) : null
        }));
    },

    addTransaction: (tx: any) => {
        dbInstance.prepare(`
      INSERT INTO transactions (id, orderId, roomName, amount, customer, status, timestamp, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            tx.id,
            tx.orderId,
            tx.roomName,
            tx.amount,
            tx.customer,
            tx.status,
            tx.timestamp,
            tx.detail ? JSON.stringify(tx.detail) : null
        );
    },

    updateTransactionStatus: (orderId: string, status: string, detail?: any) => {
        const result = dbInstance.prepare(`
      UPDATE transactions 
      SET status = ?, detail = ? 
      WHERE orderId = ?
    `).run(status, detail ? JSON.stringify(detail) : null, orderId);

        // Si el pago fue EXITOSO, bloquear la habitación automáticamente
        if (result.changes > 0 && status === 'EXITOSO') {
            try {
                const tx = dbInstance.prepare('SELECT roomName FROM transactions WHERE orderId = ?').get(orderId) as any;
                if (tx && tx.roomName) {
                    console.log(`🔒 Bloqueando habitación: ${tx.roomName}`);
                    dbInstance.prepare('UPDATE rooms SET status = ? WHERE subtitle = ?').run('reservado', tx.roomName);
                }
            } catch (error) {
                console.error("Error auto-blocking room:", error);
            }
        }

        return result.changes > 0;
    }
};
