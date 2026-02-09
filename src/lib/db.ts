import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials missing in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos
export interface Room {
    id: string;
    subtitle: string;
    unit_name: string;
    title: string;
    price: number;
    status: 'libre' | 'ocupado' | 'limpieza' | 'reservado' | 'mantenimiento';
    features: any;
    images: any;
    reverse: boolean;
}

export interface Transaction {
    id: string;
    order_id: string;
    room_name: string;
    amount: number;
    customer: any;
    status: 'PENDIENTE' | 'EXITOSO' | 'FALLIDO' | 'CANCELADO' | 'INICIADO';
    timestamp: string;
    detail?: any;
}

export interface Complaint {
    id: string;
    full_name: string;
    document_type: string;
    document_number: string;
    email: string;
    phone: string;
    address: string;
    type: string;
    description: string;
    date: string;
    status: string;
}

export const db = {
    getRooms: async (): Promise<Room[]> => {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('subtitle', { ascending: true })
            .order('unit_name', { ascending: true });

        if (error) {
            console.error('Error fetching rooms:', error);
            return [];
        }
        return data as Room[];
    },

    updateRoomStatus: async (id: string, status: string) => {
        const { error } = await supabase
            .from('rooms')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error('Error updating room status:', error);
            return false;
        }
        return true;
    },

    updateRoomPrice: async (category: string, price: number) => {
        const { error } = await supabase
            .from('rooms')
            .update({ price })
            .eq('subtitle', category);

        if (error) {
            console.error('Error updating room price:', error);
            return false;
        }
        return true;
    },

    getTransactions: async (): Promise<Transaction[]> => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
        return data as Transaction[];
    },

    addTransaction: async (tx: any) => {
        const { error } = await supabase
            .from('transactions')
            .insert({
                id: tx.id,
                order_id: tx.orderId,
                room_name: tx.roomName,
                amount: tx.amount,
                customer: tx.customer,
                status: tx.status,
                timestamp: tx.timestamp,
                detail: tx.detail || null
            });

        if (error) {
            console.error('Error adding transaction:', error);
            return false;
        }
        return true;
    },

    getRoomCategories: async () => {
        console.log('🔍 Fetching room categories from Supabase...');
        const { data: rows, error } = await supabase
            .from('rooms')
            .select('*');

        if (error) {
            console.error('❌ Error fetching categories:', error);
            return [];
        }

        if (!rows || rows.length === 0) {
            console.warn('⚠️ No rooms found in Supabase "rooms" table.');
            return [];
        }

        console.log(`✅ Found ${rows.length} room units.`);

        const grouped: Record<string, any> = {};

        rows.forEach(r => {
            const cat = r.subtitle;
            if (!grouped[cat]) {
                grouped[cat] = {
                    ...r,
                    units: [],
                    counts: {
                        libre: 0,
                        ocupado: 0,
                        limpieza: 0,
                        reservado: 0,
                        mantenimiento: 0
                    }
                };
            }
            grouped[cat].units.push({
                id: r.id,
                unit_name: r.unit_name,
                status: r.status
            });
            if (grouped[cat].counts[r.status] !== undefined) {
                grouped[cat].counts[r.status]++;
            }
        });

        return Object.values(grouped).map(cat => {
            const hasLibre = cat.counts.libre > 0;
            const allOcupado = (cat.counts.ocupado + cat.counts.reservado) === cat.units.length;

            let finalStatus = cat.status;
            if (hasLibre) finalStatus = 'libre';
            else if (allOcupado) finalStatus = 'ocupado';

            return { ...cat, status: finalStatus };
        });
    },

    transitionRoomStatus: async (category: string, fromStatus: string, toStatus: string) => {
        const { data: unit, error: findError } = await supabase
            .from('rooms')
            .select('id')
            .eq('subtitle', category)
            .eq('status', fromStatus)
            .limit(1)
            .maybeSingle();

        if (findError || !unit) return false;

        const { error: updateError } = await supabase
            .from('rooms')
            .update({ status: toStatus })
            .eq('id', unit.id);

        return !updateError;
    },

    addRoomUnit: async (category: string) => {
        const { data: prototype, error: findError } = await supabase
            .from('rooms')
            .select('*')
            .eq('subtitle', category)
            .limit(1)
            .maybeSingle();

        if (findError || !prototype) return false;

        const newId = `habitacion-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const { error: insertError } = await supabase
            .from('rooms')
            .insert({
                id: newId,
                subtitle: prototype.subtitle,
                unit_name: null,
                title: prototype.title,
                price: prototype.price,
                status: 'libre',
                features: prototype.features,
                images: prototype.images,
                reverse: prototype.reverse
            });

        return !insertError;
    },

    removeRoomUnit: async (category: string) => {
        const { data: unit, error: findError } = await supabase
            .from('rooms')
            .select('id')
            .eq('subtitle', category)
            .eq('status', 'libre')
            .limit(1)
            .maybeSingle();

        if (findError || !unit) return false;

        const { error: deleteError } = await supabase
            .from('rooms')
            .delete()
            .eq('id', unit.id);

        return !deleteError;
    },

    saveComplaint: async (data: any) => {
        const id = `reclamacion-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const date = new Date().toISOString();

        const { error } = await supabase
            .from('complaints')
            .insert({
                id,
                full_name: data.fullName,
                document_type: data.documentType,
                document_number: data.documentNumber,
                email: data.email,
                phone: data.phone,
                address: data.address,
                type: data.type,
                description: data.description,
                date,
                status: 'PENDIENTE'
            });

        return error ? null : id;
    },

    getComplaints: async (): Promise<Complaint[]> => {
        const { data, error } = await supabase
            .from('complaints')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching complaints:', error);
            return [];
        }
        return data as Complaint[];
    },

    updateComplaintStatus: async (id: string, status: string) => {
        const { error } = await supabase
            .from('complaints')
            .update({ status })
            .eq('id', id);

        return !error;
    },

    updateTransactionStatus: async (orderId: string, status: string, detail?: any) => {
        // 1. Verificar estado actual para evitar duplicidad de bloqueos
        const { data: currentTx } = await supabase
            .from('transactions')
            .select('status, room_name')
            .eq('order_id', orderId)
            .maybeSingle();

        // Si ya está exitoso y volvemos a recibir EXITOSO, ignoramos la lógica de bloqueo de habitación
        const alreadySuccessful = currentTx?.status === 'EXITOSO';

        const { error: updateError } = await supabase
            .from('transactions')
            .update({
                status,
                detail: detail || null
            })
            .eq('order_id', orderId);

        if (updateError) return false;

        // Solo bloqueamos la habitación si el nuevo estado es EXITOSO y NO estaba bloqueada previamente
        if (status === 'EXITOSO' && !alreadySuccessful) {
            try {
                const roomToBlock = currentTx?.room_name;

                if (roomToBlock) {
                    const { data: availableUnit } = await supabase
                        .from('rooms')
                        .select('id')
                        .eq('subtitle', roomToBlock)
                        .eq('status', 'libre')
                        .limit(1)
                        .maybeSingle();

                    if (availableUnit) {
                        await supabase
                            .from('rooms')
                            .update({ status: 'reservado' })
                            .eq('id', availableUnit.id);
                        console.log(`✅ Habitación bloqueada exitosamente para orden ${orderId}`);
                    }
                }
            } catch (error) {
                console.error("Error auto-blocking room:", error);
            }
        }

        return true;
    },

    deleteTransaction: async (orderId: string) => {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('order_id', orderId);

        if (error) {
            console.error('Error deleting transaction:', error);
            return false;
        }
        return true;
    }
};
