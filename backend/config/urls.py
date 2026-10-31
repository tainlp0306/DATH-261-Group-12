from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, Http404
from django.urls import path, include


def demo_slide(request):
    slide_path = settings.MEDIA_ROOT / 'lessons' / 'files' / 'slide_test.pdf'
    try:
        slide_file = slide_path.open('rb')
    except FileNotFoundError as error:
        raise Http404('Demo slide not found.') from error
    return FileResponse(slide_file, content_type='application/pdf')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('lms_core.urls')),
    path('media/lessons/files/slide_test.pdf', demo_slide, name='demo-slide'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)