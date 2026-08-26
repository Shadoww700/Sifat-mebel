from django.contrib import admin
from django.urls import path, include
from accounts.views import ProfileAPIView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/profile', ProfileAPIView.as_view())
]