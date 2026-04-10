import { react, useState, useEffect } from 'react';
import { useClan } from '../../contexts/ClanContext';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import { FiLock } from 'react-icons/fi';
import api from '../../services/api'



function ClanAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { myClan, isLoading } = useClan();
  const { user } = useSelector(selectAuth);


  //READ: Fetch on load
  useEffect(() => {
    if (myClan) loadAnnouncements();
  }, [myClan]);

  const loadAnnouncements = async () => {
    const res = await api.get(`/api/clans/${myClan._id}/announcements`);
    if (res.success) setAnnouncements(res.data);
  }

  //CREATE: Handle submission
  const handleCreate = async (formData) => {
    await api.post(`/api/clans/${myClan.clan.id}/announcements`, formData);
    setIsModalOpen(false);
    loadAnnouncements(); // Refresh list 
  }

  //DELETE: handle Removal
  const handleDelete = async (id) => {
    if (window.confirm(`Delete this briefing?`)) {
      await api.delete(`/api/clans/${myClan.clan._id}/announcements/${id}`);
      loadAnnouncements();
    }
  };

  // 1. Show loading state while fetching the clan data
  if (isLoading) return <div className='p-10 text-gray-400'>Syncing with database....</div>;

  // 2. Access control: If user is not in this clan , show a restricted message
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

  //3. User is a member, they can see the announcements 
  const isOwner = myClan.role === 'owner'; //context already gives you the role

  return (
    <div>
      <div className='flex items-center justify-between mb-8 pb-4 border-b border-white/5'>
        <div>
          <h2 className='text-3xl font-gaming font-black text-white uppercase tracking-tighter italic '> Clan Announcements</h2>
          <p className='text-xs text-gray-500 font-bold uppercase tracking-widest mt-1'>Tactical briefings and sqaud updates</p>
        </div>

        {/* 4. Only show the Create button if they are the Owner or Admin */}
        {(isOwner || myClan.role === 'admin') && (
          <button className='px-6 py-3 bg-gaming-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-xs rounded-xl shadow-lg 
        transition-all transform hover:-translate-y-1'>
            New Briefing
          </button>
        )}
      </div>

      <div className='flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-[2rem]'>
        <p className='text-gray-600 font-bold italic'>Waiting for leadership to post updates...</p>
      </div>

    </div>
  )

}

export default ClanAnnouncements;