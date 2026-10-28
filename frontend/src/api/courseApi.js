import api from './axios';

export const courseApi = {
  // GET /courses/ - List all published courses (supports ?search= keyword)
  getCourses: async (search = '', page = 1, ordering = '-created_at') => {
    const params = { page, ordering };
    if (search) params.search = search;
    const response = await api.get('courses/', { params });
    return response.data;
  },

  // GET /courses/:id/ - Retrieve course detail including modules and lessons
  getCourseDetail: async (id) => {
    const response = await api.get(`courses/${id}/`);
    return response.data;
  },

  getInstructorCourseDetail: async (id) => {
    const response = await api.get(`instructor/courses/${id}/`);
    return response.data;
  },

  getInstructorCourses: async () => {
    const response = await api.get('instructor/courses/');
    return response.data;
  },

  getLessonDetail: async (lessonId) => {
    const response = await api.get(`lessons/${lessonId}/`);
    return response.data;
  },

  getPrerequisiteOptions: async () => {
    const response = await api.get('instructor/courses/options/');
    return response.data;
  },

  sendCourseAnnouncement: async (courseId, announcement) => {
    const response = await api.post(`courses/${courseId}/announcements/`, announcement);
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
    const response = await api.post('lessons/', toLessonFormData(lessonData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

  withdrawEnrollment: async (enrollmentId) => {
    const response = await api.delete(`enrollments/${enrollmentId}/`);
    return response.data;
  },

  leaveCourse: async (courseId) => {
    const response = await api.delete(`enrollments/${courseId}/leave/`);
    return response.data;
  },

  getCourseTests: async (courseId) => {
    const response = await api.get(`courses/${courseId}/tests/`);
    return response.data;
  },

  getCourseAssignments: async (courseId) => {
    const response = await api.get(`courses/${courseId}/assignments/`);
    return response.data;
  },

  getCourseAnalytics: async (courseId) => {
    const response = await api.get(`courses/${courseId}/analytics/`);
    return response.data;
  },

  interveneCourseLearner: async (courseId, studentId) => {
    const response = await api.post(`courses/${courseId}/analytics/intervene/`, {
      student_id: studentId,
      action: 'notify',
    });
    return response.data;
  },

  getCourseLearningActivities: async (courseId) => {
    const response = await api.get(`courses/${courseId}/activities/`);
    return response.data;
  },

  createCourseLearningActivity: async (courseId, activity) => {
    const response = await api.post(`courses/${courseId}/activities/`, activity);
    return response.data;
  },

  getLearningActivity: async (activityId) => {
    const response = await api.get(`activities/${activityId}/`);
    return response.data;
  },

  updateLearningActivity: async (activityId, activity) => {
    const response = await api.patch(`activities/${activityId}/`, activity);
    return response.data;
  },

  submitLearningActivity: async (activityId, responses) => {
    const response = await api.post(`activities/${activityId}/attempts/`, { responses });
    return response.data;
  },

  getAssignmentSubmissions: async (assignmentId) => {
    const response = await api.get(`assignments/${assignmentId}/submissions/`);
    return response.data;
  },

  getAssignmentGrading: async (assignmentId) => {
    const response = await api.get(`assignments/${assignmentId}/grading/`);
    return response.data;
  },

  createCourseAssignment: async (courseId, assignment) => {
    const response = await api.post(`courses/${courseId}/assignments/`, toAssignmentFormData(assignment), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getAssignmentDetail: async (assignmentId) => {
    const response = await api.get(`assignments/${assignmentId}/`);
    return response.data;
  },

  updateCourseAssignment: async (assignmentId, assignment) => {
    const response = await api.patch(`assignments/${assignmentId}/`, toAssignmentFormData(assignment), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadQuestionAttachment: async (questionId, file) => {
    const formData = new FormData();
    formData.append('attachment', file);
    const response = await api.post(`questions/${questionId}/attachment/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  submitAssignment: async (assignmentId, submission) => {
    const response = await api.post(`assignments/${assignmentId}/submit/`, submission, {
      headers: submission instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data;
  },

  createCourseTest: async (courseId, testData) => {
    const response = await api.post(`courses/${courseId}/tests/`, testData);
    return response.data;
  },

  getTestSubmissions: async (testId) => {
    const response = await api.get(`tests/${testId}/submissions/`);
    return response.data;
  },

  submitTestFile: async (testId, file) => {
    const formData = new FormData();
    formData.append('submitted_file', file);
    const response = await api.post(`tests/${testId}/submissions/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  gradeSubmission: async (submissionId, grade, type = 'test') => {
    const response = await api.patch(`submissions/${submissionId}/grade/`, grade, {
      params: { type },
    });
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
    const response = await api.put(`lessons/${id}/`, toLessonFormData(lessonData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
    return response.data.results || response.data;
  },

  // POST /lessons/:lesson_id/comments/ - Post a new comment
  createLessonComment: async (lessonId, content) => {
    const response = await api.post(`lessons/${lessonId}/comments/`, { content });
    return response.data;
  },

  // GET /courses/:course_id/quizzes/ - Get quizzes of a course
  getCourseQuizzes: async (courseId) => {
    const response = await api.get(`courses/${courseId}/quizzes/`);
    return response.data.results || response.data;
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

function toLessonFormData(lessonData) {
  const formData = new FormData();
  Object.entries(lessonData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, key === 'pages' ? JSON.stringify(value) : value);
    }
  });
  return formData;
}

function toAssignmentFormData(assignment) {
  const formData = new FormData();
  Object.entries(assignment).forEach(([key, value]) => {
    if (value === undefined) return;
    if (key === 'questions') {
      const questions = value.map((question) => {
        const questionData = { ...question };
        delete questionData.attachment_file;
        delete questionData.attachment;
        return questionData;
      });
      formData.append(key, JSON.stringify(questions));
    } else if (value === null) {
      formData.append(key, '');
    } else {
      formData.append(key, value);
    }
  });
  return formData;
}
