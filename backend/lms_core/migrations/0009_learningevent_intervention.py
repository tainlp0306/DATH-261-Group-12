from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        (
            "lms_core",
            "0008_remove_question_quiz_assignment_question_assignment_and_more",
        ),
    ]

    # LearningEvent and Intervention are created by 0011_learning_analytics_and_activities.
    # This node only keeps the vocabulary migration branch attached. Creating the same
    # tables here made migrate fail once both branches were present.
    operations = []
