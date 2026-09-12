from django.urls import path
from . import views


urlpatterns = [
    path('categories/', views.CategoryListCreateAPIView.as_view()),
    path('categories/<int:pk>/', views.CategoryDetailAPIView.as_view()),
    path('brands/', views.BrandListCreateAPIView.as_view()),
    path('brands/<int:pk>/', views.BrandDetailAPIView.as_view()),
    path('product-types/', views.ProductTypeListCreateAPIView.as_view()),
    path('product-types/<int:pk>/', views.ProductTypeDetailAPIView.as_view()),
    path('products/', views.ProductListCreateAPIView.as_view()),
    path('product/<int:pk>/', views.ProductDetailAPIView.as_view()),
    path('product-image', views.ProductImageListCreateAPIView.as_view()),
    path('product-image/<int:pk>/', views.ProductImageDetailAPIView.as_view()),

]
