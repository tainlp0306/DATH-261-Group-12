import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center space-y-4 shadow-xl">
        <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">404 - Trang không tồn tại</h1>
        <p className="text-slate-500 text-sm">
          Đường dẫn bạn yêu cầu không khả dụng hoặc đã bị thay đổi.
        </p>
        <div className="pt-2">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Về trang chủ khóa học
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
