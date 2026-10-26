import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { buildPages } from '../utils/lessonPages';

const LessonPagination = ({ lesson, pageNumber, onPageChange, saving = false }) => {
  const pages = buildPages(lesson);
  const safePage = Math.min(Math.max(1, pageNumber), pages.length);

  return (
    <section className="mt-6" aria-label="Nội dung bài học theo trang">
      <div className="min-h-64 border-y border-slate-200 py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Nội dung bài học</h3>
          <span className="text-xs tabular-nums text-slate-500">Trang {safePage} / {pages.length}</span>
        </div>
        {pages[safePage - 1] ? (
          <div className="max-w-3xl whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{pages[safePage - 1]}</div>
        ) : (
          <p className="text-sm italic text-slate-500">Bài học này chưa có nội dung văn bản.</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 pt-4">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1 || saving}
          className="inline-flex min-h-10 items-center gap-2 border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Trang trước
        </button>
        <span className="text-xs text-slate-500">{saving ? 'Đang lưu tiến độ…' : 'Tiến độ được lưu tự động'}</span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pages.length || saving}
          className="inline-flex min-h-10 items-center gap-2 bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trang sau <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};

export default LessonPagination;
