from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('auth/register/', views.RegisterAPIView.as_view()),
    path('auth/email-verify/', views.VerifyEmailAPIView.as_view()),
    path('auth/resend-verification/', views.ResendVerificationAPIView.as_view()),
    path('auth/login/', views.LoginAPIView.as_view()),
    path('auth/token/refresh/', TokenRefreshView.as_view()),
    path('auth/logout/', views.LogoutAPIView.as_view()),
    path('auth/logout-all/', views.LogoutAllAPIView.as_view()),
    path('auth/password/forgot/', views.PasswordForgotAPIView.as_view()),
    path('auth/password/reset/', views.PasswordResetAPIView.as_view()),
    path('auth/change/password/', views.PasswordChangeAPIView.as_view()),
    path('auth/me/', views.MeAPIView.as_view()),
    path('profile/', views.ProfileAPIView.as_view()),
    path('profile/addresses/', views.AddressAPIView.as_view()),
    path('profile/addresses/<int:pk>/', views.AddressDetailAPIView.as_view())
]
