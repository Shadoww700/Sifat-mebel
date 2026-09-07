from django.urls import path
from .views import (
    CategoryDetailAPIView,
    CategoryListCreateAPIView,
    BrandListCreateAPIView,
    BrandDetailAPIView,
    ProductTypeDetailAPIView,
    ProductTypeListCreateAPIView,

)

urlpatterns = [
    path('categories/', CategoryListCreateAPIView.as_view()),
    path('categories/<int:pk>/', CategoryDetailAPIView.as_view()),
    path('brands/', BrandListCreateAPIView.as_view()),
    path('brands/<int:pk>/', BrandDetailAPIView.as_view()),
    path('product-types/', ProductTypeListCreateAPIView.as_view()),
    path('product-types/<int:pk>/', ProductTypeDetailAPIView.as_view()),
]
