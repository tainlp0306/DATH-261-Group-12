"""Dashboard adapter over the single scored classifier.

Screens and the evaluation APIs both call lms_core.services.analytics.
This module only adds the counts the instructor table already renders.
"""

from .services.analytics import analyze_course as score_course
from .services.analytics import log_learning_event


def analyze_course(course, now=None):
    report = score_course(course, now=now)
    levels = {'ok': 0, 'watch': 0, 'at_risk': 0, 'critical': 0}
    for row in report['rows']:
        level = row['risk_level'] if row['risk_level'] in levels else 'at_risk'
        levels[level] += 1
    report['students'] = report['rows']
    report['enrolled_count'] = len(report['rows'])
    report['risk_counts'] = levels
    report['at_risk_count'] = levels['at_risk'] + levels['critical']
    return report


__all__ = ['analyze_course', 'log_learning_event']
