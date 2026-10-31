from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.urls import path, include


def demo_slide(request):
    slide_name = 'lessons/files/slide_test.pdf'
    if settings.SUPABASE_STORAGE_ENABLED:
        return HttpResponseRedirect(default_storage.url(slide_name))
    try:
        slide_file = default_storage.open(slide_name, 'rb')
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