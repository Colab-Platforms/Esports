import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../../services/api';

const StoreManagementPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    price: 0,
    category: 'other',
    stock: -1,
    isActive: true
  });

  const categories = [
    { value: 'avatar', label: 'Avatar' },
    { value: 'badge', label: 'Badge' },
    { value: 'theme', label: 'Theme' },
    { value: 'boost', label: 'Boost' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/store');
      if (response.success) {
        setItems(response.data.items);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingItem) {
        // Update existing item
        const response = await api.put(`/api/admin/coin/store/${editingItem._id}`, formData);
        if (response.success) {
          alert('Item updated successfully');
        }
      } else {
        // Create new item
        const response = await api.post('/api/admin/coin/store', formData);
        if (response.success) {
          alert('Item created successfully');
        }
      }

      // Reset form
      setShowForm(false);
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        image: '',
        price: 0,
        category: 'other',
        stock: -1,
        isActive: true
      });
      fetchItems();
    } catch (error) {
      console.error('Store item save error:', error);
      alert(error.message || 'Failed to save item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      image: item.image || '',
      price: item.price,
      category: item.category,
      stock: item.stock,
      isActive: item.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item? This action cannot be undone.')) return;

    try {
      const response = await api.delete(`/api/admin/coin/store/${id}`);
      if (response.success) {
        alert('Item deleted successfully');
        fetchItems();
      }
    } catch (error) {
      alert('Failed to delete item');
    }
  };

  const handleToggleActive = async (item) => {
    try {
      const response = await api.put(`/api/admin/coin/store/${item._id}`, {
        isActive: !item.isActive
      });
      if (response.success) {
        fetchItems();
      }
    } catch (error) {
      alert('Failed to update item status');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      image: '',
      price: 0,
      category: 'other',
      stock: -1,
      isActive: true
    });
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center space-x-2 text-gaming-gold hover:text-yellow-400 mb-4"
            >
              <FiArrowLeft />
              <span>Back to Admin</span>
            </Link>
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">
              🛍️ Store Management
            </h1>
            <p className="text-gray-400">
              Manage store items and inventory
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-gaming flex items-center space-x-2"
          >
            <FiPlus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gaming p-6 mb-8"
          >
            <h3 className="text-xl font-bold text-white mb-4">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Item Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Price (Coins) *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Stock (-1 for unlimited)
                  </label>
                  <input
                    type="number"
                    min="-1"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows="3"
                  className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Image URL</label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://example.com/image.png"
                  className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-gaming-gold bg-gaming-charcoal border-gaming-border rounded focus:ring-gaming-gold"
                />
                <label htmlFor="isActive" className="text-sm text-gray-400">
                  Active (visible in store)
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gaming-charcoal text-white rounded-lg hover:bg-gaming-border transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gaming">
                  {editingItem ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Items List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading items...</div>
        ) : items.length === 0 ? (
          <div className="card-gaming p-8 text-center">
            <p className="text-gray-400 mb-4">No items in store</p>
            <button onClick={() => setShowForm(true)} className="btn-gaming">
              Add First Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card-gaming overflow-hidden ${
                  !item.isActive ? 'opacity-60' : ''
                }`}
              >
                {/* Item Image */}
                {item.image && (
                  <div className="h-48 bg-gaming-charcoal flex items-center justify-center">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}

                <div className="p-6">
                  {/* Category & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-block px-3 py-1 bg-gaming-neon/20 text-gaming-neon text-xs rounded-full">
                      {item.category}
                    </span>
                    {!item.isActive && (
                      <span className="text-xs text-red-400">Inactive</span>
                    )}
                  </div>

                  {/* Item Name */}
                  <h3 className="text-lg font-bold text-white mb-2">
                    {item.name}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Stock & Price */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gaming-border">
                    <div>
                      <p className="text-xs text-gray-500">Stock</p>
                      <p className="text-white font-medium">
                        {item.stock === -1 ? 'Unlimited' : item.stock}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="text-2xl font-bold text-gaming-gold">
                        {item.price}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className="flex-1 px-3 py-2 bg-gaming-charcoal hover:bg-gaming-border text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                      title={item.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {item.isActive ? (
                        <>
                          <FiEyeOff className="w-4 h-4" />
                          <span className="text-sm">Hide</span>
                        </>
                      ) : (
                        <>
                          <FiEye className="w-4 h-4" />
                          <span className="text-sm">Show</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleEdit(item)}
                      className="flex-1 px-3 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                      <FiEdit2 className="w-4 h-4" />
                      <span className="text-sm">Edit</span>
                    </button>

                    <button
                      onClick={() => handleDelete(item._id)}
                      className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreManagementPage;
