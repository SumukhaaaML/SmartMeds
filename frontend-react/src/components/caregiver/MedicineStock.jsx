import { useState, useEffect } from 'react';
import { rtdb } from '../../config/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';

export default function MedicineStock({ user }) {
    const [stockItems, setStockItems] = useState([]);
    const [newMedicineName, setNewMedicineName] = useState('');
    const [newQuantity, setNewQuantity] = useState('');
    const [newUnit, setNewUnit] = useState('tablets');
    const [newExpiryDate, setNewExpiryDate] = useState('');
    const [newReorderLevel, setNewReorderLevel] = useState('10');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Load medicine stock
    useEffect(() => {
        const stockRef = ref(rtdb, `medicineStock/${user.uid}`);
        const unsubscribe = onValue(stockRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const items = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setStockItems(items);
            } else {
                setStockItems([]);
            }
        });
        return unsubscribe;
    }, [user.uid]);

    const addStockItem = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newMedicineName.trim() || !newQuantity.trim()) {
            setError('Please enter medicine name and quantity');
            return;
        }

        setLoading(true);
        try {
            const stockRef = ref(rtdb, `medicineStock/${user.uid}`);
            const newItemRef = push(stockRef);

            await set(newItemRef, {
                name: newMedicineName.trim(),
                quantity: parseInt(newQuantity) || 0,
                unit: newUnit,
                expiryDate: newExpiryDate || null,
                reorderLevel: parseInt(newReorderLevel) || 10,
                addedAt: new Date().toISOString(),
                addedBy: user.email
            });

            setSuccess(`✅ ${newMedicineName} added to stock`);
            setNewMedicineName('');
            setNewQuantity('');
            setNewUnit('tablets');
            setNewExpiryDate('');
            setNewReorderLevel('10');
        } catch (err) {
            setError('Failed to add stock: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteStockItem = async (itemId) => {
        if (!window.confirm('Delete this stock item?')) return;
        try {
            await remove(ref(rtdb, `medicineStock/${user.uid}/${itemId}`));
            setSuccess('✅ Stock item removed');
        } catch (err) {
            setError('Failed to delete: ' + err.message);
        }
    };

    const isLowStock = (item) => {
        return item.quantity <= (item.reorderLevel || 10);
    };

    const isExpired = (item) => {
        if (!item.expiryDate) return false;
        return new Date(item.expiryDate) < new Date();
    };

    return (
        <div className="medicines-section">
            <h2>📦 Medicine Stock</h2>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={addStockItem} className="add-medicine-form">
                <input
                    type="text"
                    placeholder="Medicine Name"
                    value={newMedicineName}
                    onChange={(e) => setNewMedicineName(e.target.value)}
                    className="form-input"
                />
                <input
                    type="number"
                    placeholder="Quantity"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="form-input"
                    min="0"
                />
                <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="form-input"
                >
                    <option value="tablets">Tablets</option>
                    <option value="ml">ML</option>
                    <option value="capsules">Capsules</option>
                    <option value="bottles">Bottles</option>
                </select>
                <input
                    type="date"
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    className="form-input"
                    placeholder="Expiry Date"
                />
                <input
                    type="number"
                    placeholder="Reorder Level"
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(e.target.value)}
                    className="form-input"
                    min="0"
                />
                <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Adding...' : 'Add to Stock'}
                </button>
            </form>

            {/* Stock Items List */}
            {stockItems.length === 0 ? (
                <p className="no-data">No stock items yet</p>
            ) : (
                <>
                    <div className="stock-summary">
                        <strong>Total Items:</strong> {stockItems.length} |
                        <strong className="warning-text"> Low Stock: </strong>
                        {stockItems.filter(isLowStock).length}
                    </div>
                    <ul className="medicines-list">
                        {stockItems.map(item => (
                            <li
                                key={item.id}
                                className={`medicine-item ${isLowStock(item) ? 'low-stock' : ''} ${isExpired(item) ? 'expired' : ''}`}
                            >
                                <div className="medicine-info">
                                    <strong>{item.name}</strong>
                                    <small>
                                        {item.quantity} {item.unit}
                                        {isLowStock(item) && <span className="warning-badge">⚠️ Low Stock</span>}
                                        {isExpired(item) && <span className="error-badge">🔴 Expired</span>}
                                    </small>
                                    {item.expiryDate && (
                                        <small className="expiry-date">
                                            Expires: {new Date(item.expiryDate).toLocaleDateString()}
                                        </small>
                                    )}
                                </div>
                                <button
                                    onClick={() => deleteStockItem(item.id)}
                                    className="btn-remove"
                                    title="Delete stock"
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
