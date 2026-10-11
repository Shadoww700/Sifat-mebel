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
    path('attributes/', views.AttributeListCreateAPIView.as_view()),
    path('attributes/<int:pk>/', views.AttributeDetailAPIView.as_view()),
    path('product-type-attributes/', views.ProductTypeAttributeListCreateAPIView.as_view()),
    path('product-type-attributes/<int:pk>/', views.ProductTypeAttributeDetailAPIView.as_view()),
    path('product-attribute-values/', views.ProductAttributeValueListCreateAPIView.as_view()),
    path('product-attribute-values/<int:pk>/', views.ProductAttributeValueDetailAPIView.as_view()),
    path('product-variants/', views.ProductVariantListCreateAPIView.as_view()),
    path('product-variants/<int:pk>/', views.ProductVariantDetailAPIView.as_view()),
    path('variant-attribute-values/', views.VariantAttributeValueListCreateAPIView.as_view()),
    path('variant-attribute-values/<int:pk>/', views.VariantAttributeValueDetailAPIView.as_view()),
    path('stock/adjust/', views.StockAdjustAPIView.as_view()),
    path("stock/movements/", views.StockMovementListAPIView.as_view()),

]
