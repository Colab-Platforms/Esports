import { useState, useEffect } from 'react';
import { useClan } from '../../contexts/ClanContext';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import { FiLock, FiPlus, FiTrash2, FiEdit3, FiX, FiInfo } from 'react-icons/fi';
import api from '../../services/api'
import { motion, AnimatePresence } from 'framer-motion';

function ClanAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const { myClan, isLoading } = useClan();
  const { user } = useSelector(selectAuth);

  // READ: Fetch on load
  useEffect(() => {
    if (myClan) loadAnnouncements();
  }, [myClan]);

  const loadAnnouncements = async () => {
    try {
      const res = await api.get(`/api/clans/${myClan.clan._id}/announcements`);
      if (res.success) setAnnouncements(res.data);
    } catch (error) {
      console.error('❌ Error loading announcements:', error);
    }
  }

  // CREATE / UPDATE: Handle submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAnnouncement) {
        await api.patch(`/api/clans/${myClan.clan._id}/announcements/${editingAnnouncement._id}`, formData);
      } else {
        await api.post(`/api/clans/${myClan.clan._id}/announcements`, formData);
      }
      setIsModalOpen(false);
      setEditingAnnouncement(null);
      setFormData({ title: '', content: '' });
      loadAnnouncements();
    } catch (error) {
      console.error('❌ Error submitting announcement:', error);
    }
  }

  // DELETE: handle Removal
  const handleDelete = async (id) => {
    if (window.confirm(`Are you sure you want to delete this tactical briefing?`)) {
      try {
        await api.delete(`/api/clans/${myClan.clan._id}/announcements/${id}`);
        loadAnnouncements();
      } catch (error) {
        console.error('❌ Error deleting announcement:', error);
      }
    }
  };

  const openModal = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({ title: announcement.title, content: announcement.content });
    } else {
      setEditingAnnouncement(null);
      setFormData({ title: '', content: '' });
    }
    setIsModalOpen(true);
  };

  if (isLoading) return <div className='p-10 text-gray-400'>Syncing secure channel....</div>;

  if (!myClan) {
    return (
      <div className='flex flex-col items-center justify-center h-[60vh] text-center space-y-4'>
        <FiLock className='w-16 h-16 text-gray-600 mb-2' />
        <h2 className='text-2xl font-black text-white uppercase italic'>Signal Restricted</h2>
        <p className='text-gray-500 max-w-sm'>
          Announcements are encrypted for clan members only. Join the squad to access these briefings.
        </p>
      </div>
    );
  }

  const isOwner = myClan.role === 'owner';
  const isAdmin = myClan.role === 'admin';
  const canManage = isOwner || isAdmin;

  return (
    <div className="relative">
      <div className='flex items-center justify-between mb-8 pb-4 border-b border-white/5'>
        <div>
          <h2 className='text-3xl font-gaming font-black text-white uppercase tracking-tighter italic '>Tactical Briefings</h2>
          <p className='text-xs text-gray-500 font-bold uppercase tracking-widest mt-1'>Clan-wide announcements and operational updates</p>
        </div>

        {canManage && (
          <button 
            onClick={() => openModal()}
            className='flex items-center space-x-2 px-6 py-3 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-xs rounded-xl shadow-lg 
            transition-all transform hover:-translate-y-1 active:scale-95'>
            <FiPlus className="w-4 h-4" />
            <span>New Briefing</span>
          </button>
        )}
      </div>

      {announcements.length === 0 ? (
        <div className='flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.02]'>
          <FiInfo className="w-8 h-8 text-white/10 mb-4" />
          <p className='text-gray-600 font-bold italic'>No tactical briefings posted yet...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {announcements.map((item, index) => (
              <motion.div 
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative p-6 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gaming-gold animate-pulse" />
                    <h3 className="text-xl font-bold text-white tracking-tight">{item.title}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-gray-500 font-mono uppercase bg-white/5 px-2 py-1 rounded">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    {canManage && (
                      <div className="flex space-x-1 opacity-10 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openModal(item)}
                          className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                        >
                          <FiEdit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item._id)}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gaming-gold/20 flex items-center justify-center">
                      <span className="text-[10px] font-black text-gaming-gold">
                        {(item.author?.username || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                      Posted by {item.author?.username || 'Leadership'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                    {editingAnnouncement ? 'Edit Briefing' : 'New Briefing'}
                  </h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Tactical broadcast channel</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <FiX className="text-white w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 px-1">Subject</label>
                  <input 
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Operation Overlord..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-gray-700 outline-none focus:border-gaming-gold/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 px-1">Strategic Content</label>
                  <textarea 
                    required
                    rows={5}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter briefing details..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-gray-700 outline-none focus:border-gaming-gold/50 transition-all resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-lg 
                  transition-all transform active:scale-95"
                >
                  {editingAnnouncement ? 'Update Briefing' : 'Initiate Broadcast'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ClanAnnouncements;