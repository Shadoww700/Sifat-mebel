from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterAPIView.as_view()),
    path('email-verify/', views.VerifyEmailAPIView.as_view()),
    path('resend-verification/', views.ResendVerificationAPIView.as_view()),
    path('login/', views.LoginAPIView.as_view()),
]
