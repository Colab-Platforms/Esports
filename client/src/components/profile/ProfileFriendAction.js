import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function ProfileFriendAction({ username }) {
  const token = localStorage.getItem('token');
  const [friend, setFriend] = useState(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const base = process.env.REACT_APP_API_URL || '';
  let ownUsername;
  try { ownUsername = JSON.parse(localStorage.getItem('user') || '{}').username; } catch (_) { /* ignore invalid cache */ }

  useEffect(() => {
    let active = true;
    setFriend(null); setFailed(false);
    if (!token || ownUsername === username) return undefined;
    axios.get(`${base}/api/users/profile/${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      if (active && localStorage.getItem('token') === token) setFriend({ id: data._id, status: data.friendStatus });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [base, token, username, ownUsername, retry]);

  if (ownUsername === username) return null;
  if (!token) return <Link className="btn btn-ghost mt-3" to="/login" state={{ from: `/player/${username}` }}>Sign in to add friends</Link>;
  if (failed) return <button className="btn btn-ghost mt-3" onClick={() => setRetry(value => value + 1)}>Retry friend status</button>;
  if (!friend?.id) return null;
  const labels = { friends: 'Friends', pending: 'Request pending', received: 'Request received' };
  const sendRequest = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${base}/api/users/friend-request`, { recipientId: friend.id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!data.success) throw new Error('Request failed');
      if (localStorage.getItem('token') === token) setFriend(value => ({ ...value, status: 'pending' }));
      toast.success('Friend request sent!');
    } catch (_) { toast.error('Could not send friend request. Please try again.'); }
    finally { setBusy(false); }
  };
  return <button type="button" className="btn btn-primary mt-3" disabled={busy || Boolean(labels[friend.status])} onClick={sendRequest}>
    {labels[friend.status] || (busy ? 'Sending request…' : 'Add Friend')}
  </button>;
}
