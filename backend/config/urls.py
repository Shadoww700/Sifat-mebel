from django.contrib import admin
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.urls import path, include


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('accounts.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]