import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiUpload, FiX } from 'react-icons/fi';
import api from '../../services/api';

const StoreManagementPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    price: 0,
    category: 'other',
    game: 'all',
    stock: -1,
    isActive: true
  });

  const categories = [
    { value: 'uc', label: '💎 UC / Diamonds' },
    { value: 'cosmetics', label: '🎨 Cosmetics' },
    { value: 'passes', label: '🎫 Game Passes' },
    { value: 'avatar', label: 'Avatar' },
    { value: 'badge', label: 'Badge' },
    { value: 'theme', label: 'Theme' },
    { value: 'boost', label: 'Boost' },
    { value: 'other', label: 'Other' }
  ];

  const gameOptions = [
    { value: 'bgmi',     label: '🟡 BGMI' },
    { value: 'freefire', label: '🔴 Free Fire' },
    { value: 'all',      label: '🎮 All Games' },
  ];

  const gameBadge = {
    bgmi:     { label: 'BGMI',      cls: 'bg-yellow-500/20 text-yellow-400' },
    freefire: { label: 'Free Fire', cls: 'bg-red-500/20 text-red-400' },
    all:      { label: 'All Games', cls: 'bg-blue-500/20 text-blue-400' },
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/coin/store');
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

    if (!formData.image) {
      alert('Please upload an image for this item.');
      return;
    }

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
      setImagePreview('');
      setFormData({
        name: '',
        description: '',
        image: '',
        price: 0,
        category: 'other',
        game: 'all',
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
    setImagePreview(item.image || '');
    setFormData({
      name: item.name,
      description: item.description,
      image: item.image || '',
      price: item.price,
      category: item.category,
      game: item.game || 'all',
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);

    setImageUploading(true);
    try {
      const formPayload = new FormData();
      formPayload.append('image', file);
      const response = await api.post('/api/admin/coin/store/upload-image', formPayload);
      if (response.success) {
        setFormData(prev => ({ ...prev, image: response.data.url }));
        setImagePreview(response.data.url);
      }
    } catch (error) {
      alert('Image upload failed: ' + (error.message || 'Unknown error'));
      setImagePreview(formData.image || '');
    } finally {
      setImageUploading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
    setImagePreview('');
    setFormData({
      name: '',
      description: '',
      image: '',
      price: 0,
      category: 'other',
      game: 'all',
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
                  <label className="block text-sm text-gray-400 mb-2">Game *</label>
                  <select
                    value={formData.game}
                    onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                  >
                    {gameOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
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
                <label className="block text-sm text-gray-400 mb-2">Image <span className="text-red-400">*</span></label>
                {/* Preview */}
                {imagePreview && (
                  <div className="relative w-32 h-32 mb-3 rounded-lg overflow-hidden bg-gaming-charcoal border border-gaming-border">
                    <img src={imagePreview} alt="preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => { setImagePreview(''); setFormData(prev => ({ ...prev, image: '' })); }}
                      className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5 text-white"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-300 hover:border-gaming-gold transition-colors disabled:opacity-50 ${
                    !formData.image ? 'border border-red-500/60 bg-gaming-charcoal' : 'border border-gaming-border bg-gaming-charcoal'
                  }`}
                >
                  <FiUpload className="w-4 h-4" />
                  <span className="text-sm">{imageUploading ? 'Uploading...' : imagePreview ? 'Change Image' : 'Upload Image'}</span>
                </button>
                {!formData.image && (
                  <p className="text-xs text-red-400 mt-1">Image is required</p>
                )}
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
                <button type="submit" className="btn-gaming" disabled={imageUploading}>
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
                  {/* Category, Game & Status */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="px-3 py-1 bg-gaming-neon/20 text-gaming-neon text-xs rounded-full">
                      {item.category}
                    </span>
                    {item.game && gameBadge[item.game] && (
                      <span className={`px-3 py-1 text-xs rounded-full font-semibold ${gameBadge[item.game].cls}`}>
                        {gameBadge[item.game].label}
                      </span>
                    )}
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
