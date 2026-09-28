import api from './axios';

export const courseApi = {
  // GET /courses/ - List all published courses (supports ?search= keyword)
  getCourses: async (search = '') => {
    const params = search ? { search } : {};
    const response = await api.get('courses/', { params });
    return response.data;
  },

  // GET /courses/:id/ - Retrieve course detail including modules and lessons
  getCourseDetail: async (id) => {
    const response = await api.get(`courses/${id}/`);
    return response.data;
  },

  // POST /courses/ - Create a new course (Instructor/Admin)
  createCourse: async (courseData) => {
    const response = await api.post('courses/', courseData);
    return response.data;
  },

  // POST /modules/ - Create a new module inside a course
  createModule: async (moduleData) => {
    const response = await api.post('modules/', moduleData);
    return response.data;
  },

  // POST /lessons/ - Create a new lesson inside a module
  createLesson: async (lessonData) => {
    const response = await api.post('lessons/', lessonData);
    return response.data;
  },

  // POST /enrollments/ - Enroll in a course (body: { course: course_id })
  enrollCourse: async (courseId) => {
    const response = await api.post('enrollments/', { course: courseId });
    return response.data;
  },

  // GET /enrollments/ - Get current user enrollments
  getMyEnrollments: async () => {
    const response = await api.get('enrollments/');
    return response.data;
  },

  // POST /lessons/:lesson_id/progress/ - Save progress
  updateLessonProgress: async (lessonId, progressData) => {
    const response = await api.post(`lessons/${lessonId}/progress/`, progressData);
    return response.data;
  },

  // GET /courses/:course_id/my-progress/ - Get current student's completed lessons in course
  getMyProgress: async (courseId) => {
    const response = await api.get(`courses/${courseId}/my-progress/`);
    return response.data;
  },

  // GET /courses/:course_id/students-progress/ - Instructor: get list of students and their progress
  getCourseStudentsProgress: async (courseId) => {
    const response = await api.get(`courses/${courseId}/students-progress/`);
    return response.data;
  },

  // PUT /courses/:id/ - Update course (edit info / toggle publish)
  updateCourse: async (id, courseData) => {
    const response = await api.put(`courses/${id}/`, courseData);
    return response.data;
  },

  // DELETE /courses/:id/ - Delete course
  deleteCourse: async (id) => {
    const response = await api.delete(`courses/${id}/`);
    return response.data;
  },

  // PUT /modules/:id/ - Update module
  updateModule: async (id, moduleData) => {
    const response = await api.put(`modules/${id}/`, moduleData);
    return response.data;
  },

  // DELETE /modules/:id/ - Delete module
  deleteModule: async (id) => {
    const response = await api.delete(`modules/${id}/`);
    return response.data;
  },

  // PUT /lessons/:id/ - Update lesson
  updateLesson: async (id, lessonData) => {
    const response = await api.put(`lessons/${id}/`, lessonData);
    return response.data;
  },

  // DELETE /lessons/:id/ - Delete lesson
  deleteLesson: async (id) => {
    const response = await api.delete(`lessons/${id}/`);
    return response.data;
  },

  // GET /lessons/:lesson_id/comments/ - Get comments of a lesson
  getLessonComments: async (lessonId) => {
    const response = await api.get(`lessons/${lessonId}/comments/`);
    return response.data;
  },

  // POST /lessons/:lesson_id/comments/ - Post a new comment
  createLessonComment: async (lessonId, content) => {
    const response = await api.post(`lessons/${lessonId}/comments/`, { content });
    return response.data;
  },

  // GET /courses/:course_id/quizzes/ - Get quizzes of a course
  getCourseQuizzes: async (courseId) => {
    const response = await api.get(`courses/${courseId}/quizzes/`);
    return response.data;
  },

  // GET /quizzes/:id/ - Get quiz details
  getQuizDetail: async (quizId) => {
    const response = await api.get(`quizzes/${quizId}/`);
    return response.data;
  },

  // POST /quizzes/:quiz_id/submit/ - Submit quiz answers
  submitQuiz: async (quizId, answers) => {
    const response = await api.post(`quizzes/${quizId}/submit/`, { answers });
    return response.data;
  },
};

