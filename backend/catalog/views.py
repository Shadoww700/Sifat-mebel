from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated,IsAdminUser
from .permissions import (
    IsAdminOrReadonly
)


from . import models
    
from . import serializers


class CategoryListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.CategorySerializer

    def get_queryset(self):
        if self.request.method == 'GET':
            return models.Category.objects.active().ordered()
        return models.Category.objects.ordered()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminUser()]


class CategoryDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.CategorySerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if self.request.method == 'GET':
            return models.Category.objects.active()
        return models.Category.objects.all()


class BrandListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.BrandSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if self.request.user.is_staff:
            return models.Brand.objects.all().order_by('id')
        return models.Brand.objects.filter(
            is_active=True
        ).order_by('id')


class BrandDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.BrandSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if self.request.user.is_staff:
            return models.Brand.objects.all()
        return models.Brand.objects.filter(is_active=True)


class ProductTypeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductTypeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductType.objects.select_related('category')
        if self.request.user.is_staff:
            return qs   
                
        return qs.filter(is_active=True)


class ProductTypeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductTypeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductType.objects.select_related('category')
        if self.request.user.is_staff:
            return qs   
        
        return qs.filter(is_active=True)


class ProductListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.Product.objects.select_related('brand', 'product_type__category')
        
        if self.request.user.is_staff:
            return qs
        
        return qs.filter(
            is_active=True, 
            status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK
                            ])


class ProductDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.Product.objects.select_related(
            'brand',
            'product_type__category')
        if self.request.user.is_staff:
            return qs
        
        return qs.filter(
            is_active=True,
            status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK
            ])

    def perform_destroy(self, instance):
        instance.archive()



class ProductImageListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductImageSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductImage.objects.select_related('product')
        if self.request.user.is_staff:
            return qs
        return qs.filter(
            product__is_active=True,
            product__status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK
            ])


class ProductImageDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductImageSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductImage.objects.select_related('product')
        if self.request.user.is_staff:
            return qs
        return qs.filter(
            product__is_active=True,
            product__status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK
            ])
    