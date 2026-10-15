import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiStar, FiUpload } from 'react-icons/fi';
import { selectAuth } from '../../../store/slices/authSlice';
import exploreService from '../services/exploreService';
import CustomDropdown from '../../../components/common/CustomDropdown';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import OptimizedImage from '../../../components/common/OptimizedImage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const CONTENT_TYPE_OPTIONS = [
  { value: 'video', label: 'Video' },
  { value: 'article', label: 'Article' },
  { value: 'social', label: 'Social' },
  { value: 'resource', label: 'Resource' }
];

const PLATFORM_OPTIONS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'external', label: 'External' }
];

const EMPTY_FORM = {
  title: '',
  description: '',
  url: '',
  thumbnailUrl: '',
  contentType: 'video',
  platform: 'external',
  isFeatured: false,
  isActive: true,
  displayOrder: 0
};

const ExploreContentManagement = () => {
  const { user } = useSelector(selectAuth);
  const canManage = user && ['admin', 'moderator', 'designer'].includes(user.role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await exploreService.getAdminExploreContent({ limit: 100 });
      if (response.success) {
        setItems(response.data.items || []);
      } else {
        toast.error(response.error?.message || 'Failed to load content');
      }
    } catch (error) {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) fetchItems();
  }, [canManage, fetchItems]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      url: item.url || '',
      thumbnailUrl: item.thumbnailUrl || '',
      contentType: item.contentType || 'video',
      platform: item.platform || 'external',
      isFeatured: Boolean(item.isFeatured),
      isActive: item.isActive !== false,
      displayOrder: item.displayOrder ?? 0
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleThumbnailSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size should be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();

      if (data.success) {
        handleFieldChange('thumbnailUrl', data.data.imageUrl);
        toast.success('Thumbnail uploaded');
      } else {
        toast.error(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const isValidUrl = (value) => /^https?:\/\/[^\s]+$/i.test(value);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) return toast.error('Title is required');
    if (!isValidUrl(form.url)) return toast.error('URL must start with http:// or https://');
    if (!form.thumbnailUrl) return toast.error('Thumbnail is required');
    if (!form.contentType) return toast.error('Content type is required');

    setSaving(true);
    try {
      const payload = { ...form, displayOrder: Number(form.displayOrder) || 0 };
      const response = editingId
        ? await exploreService.updateExploreContent(editingId, payload)
        : await exploreService.createExploreContent(payload);

      if (response.success) {
        toast.success(editingId ? 'Content updated' : 'Content created');
        closeForm();
        fetchItems();
      } else {
        toast.error(response.error?.message || 'Failed to save content');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      const response = await exploreService.toggleExploreContent(item._id);
      if (response.success) {
        toast.success(response.data.item.isActive ? 'Content activated' : 'Content deactivated');
        fetchItems();
      } else {
        toast.error(response.error?.message || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const confirmDelete = (item) => setDeleteTarget(item);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await exploreService.deleteExploreContent(deleteTarget._id);
      if (response.success) {
        toast.success('Content deleted');
        setDeleteTarget(null);
        fetchItems();
      } else {
        toast.error(response.error?.message || 'Failed to delete content');
      }
    } catch (error) {
      toast.error('Failed to delete content');
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
        Admin, moderator, or designer access required.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Explore Content</h1>
        <button
          type="button"
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2 bg-gaming-gold text-black font-medium rounded-lg hover:bg-yellow-500 transition-colors"
        >
          <FiPlus className="w-4 h-4" /> Add Content
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-gaming-card border border-gaming-border rounded-lg p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">
            {editingId ? 'Edit Content' : 'New Content'}
          </h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              maxLength={150}
              className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:border-gaming-gold"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:border-gaming-gold"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => handleFieldChange('url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:border-gaming-gold"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Thumbnail * (16:9 recommended, e.g. 1280×720)</label>
            <div className="flex items-center gap-4">
              {form.thumbnailUrl && (
                <OptimizedImage
                  src={form.thumbnailUrl}
                  alt="Thumbnail preview"
                  className="w-32 aspect-video rounded-lg border border-gaming-border"
                />
              )}
              <label className="flex items-center gap-2 px-4 py-2 bg-gaming-slate text-white rounded-lg cursor-pointer hover:bg-gaming-charcoal transition-colors">
                <FiUpload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload Image'}
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailSelect} disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomDropdown
              label="Content Type"
              required
              options={CONTENT_TYPE_OPTIONS}
              value={form.contentType}
              onChange={(value) => handleFieldChange('contentType', value)}
            />
            <CustomDropdown
              label="Platform"
              options={PLATFORM_OPTIONS}
              value={form.platform}
              onChange={(value) => handleFieldChange('platform', value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Display Order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => handleFieldChange('displayOrder', e.target.value)}
                className="w-full px-3 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:border-gaming-gold"
              />
            </div>
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => handleFieldChange('isFeatured', e.target.checked)}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => handleFieldChange('isActive', e.target.checked)}
              />
              Active
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gaming-gold text-black font-medium rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Content'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-5 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-gaming-card border border-gaming-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gaming-border text-gray-400">
                <th className="px-4 py-3">Thumbnail</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No content yet.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-b border-gaming-border/50">
                    <td className="px-4 py-3">
                      <OptimizedImage src={item.thumbnailUrl} alt={item.title} className="w-16 aspect-video rounded" />
                    </td>
                    <td className="px-4 py-3 text-white max-w-xs truncate">{item.title}</td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{item.contentType}</td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{item.platform}</td>
                    <td className="px-4 py-3">
                      {item.isFeatured && <FiStar className="w-4 h-4 text-gaming-gold" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${item.isActive ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{item.displayOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => openEditForm(item)} title="Edit" className="text-gray-300 hover:text-white">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleToggleActive(item)} title="Toggle active" className="text-gray-300 hover:text-white">
                          {item.isActive ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => confirmDelete(item)} title="Delete" className="text-red-400 hover:text-red-300">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Content"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={deleting}
      />
    </div>
  );
};

export default ExploreContentManagement;
