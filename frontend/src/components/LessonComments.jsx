import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';

const LessonComments = ({ lessonId }) => {
  const { isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!lessonId) return;
    if (!isAuthenticated) return;

    const fetchComments = async () => {
      try {
        setLoading(true);
        const data = await courseApi.getLessonComments(lessonId);
        setComments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching comments:', err);
        toast.error('Không thể tải thảo luận của bài học.');
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [lessonId, isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để bình luận!');
      return;
    }

    try {
      setSubmitting(true);
      const created = await courseApi.createLessonComment(lessonId, newComment.trim());
      setComments((prev) => [created, ...prev]);
      setNewComment('');
      toast.success('Đã gửi bình luận thành công!');
    } catch (err) {
      console.error('Error creating comment:', err);
      toast.error(err.response?.data?.content?.[0] || 'Không thể gửi bình luận. Vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          Hỏi đáp & Thảo luận ({comments.length})
        </h3>
        <span className="text-xs text-slate-400 font-medium">Cộng đồng LingoSphere</span>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            rows={3}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={
              isAuthenticated
                ? 'Đặt câu hỏi hoặc chia sẻ suy nghĩ của bạn về bài học này...'
                : 'Vui lòng đăng nhập để tham gia thảo luận...'
            }
            disabled={!isAuthenticated || submitting}
            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60 resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isAuthenticated || submitting || !newComment.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Gửi thảo luận</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-4 pt-2">
        {!isAuthenticated ? (
          <div className="text-center py-6 text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            Đăng nhập để xem và tham gia thảo luận bài học.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            Chưa có thảo luận nào cho bài học này. Hãy là người đầu tiên đặt câu hỏi!
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {comment.username ? comment.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {comment.username || 'Học viên ẩn danh'}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-700 whitespace-pre-line pl-10">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LessonComments;
