from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated,IsAdminUser
from .permissions import (
    IsAdminOrReadonly
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

    
from . import serializers, models, services


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


class AttributeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.AttributeSerializer
    permission_classes = [IsAdminOrReadonly]
    queryset = models.Attribute.objects.all()


class AttributeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.AttributeSerializer
    permission_classes = [IsAdminOrReadonly]
    queryset = models.Attribute.objects.all()


class ProductTypeAttributeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductTypeAttributeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductTypeAttribute.objects.select_related(
            'product_type__category', 'attribute'
        ).order_by('sort_order', 'id')

        if self.request.user.is_staff:
            return qs
        return qs.filter(
            product_type__is_active=True
        )


class ProductTypeAttributeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductTypeAttributeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductTypeAttribute.objects.select_related(
            'product_type__category', 'attribute'
        ).order_by('sort_order', 'id')
    
        if self.request.user.is_staff:
            return qs
        return qs.filter(
            product_type__is_active=True
        )


class ProductAttributeValueListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductAttributeValue.objects.select_related(
            'product', 'attribute'
        )

        if self.request.user.is_staff:
            return qs
        return qs.filter(
            product__is_active=True,
            product__status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK
            ])


class ProductAttributeValueDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductAttributeValue.objects.select_related(
            'product', 'attribute'
        )

        if self.request.user.is_staff:
            return qs
        return qs.filter(
            product__is_active=True,
            product__status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK
            ])


class ProductVariantListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductVariantSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductVariant.objects.select_related('product')
        if self.request.user.is_staff:
            return qs
        
        return qs.filter(product__is_active=True)

class ProductVariantDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductVariantSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductVariant.objects.select_related('product')
        if self.request.user.is_staff:
            return qs
            
        return qs.filter(
            is_active=True,
            product__is_active=True,
            product__status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK,
            ])


class VariantAttributeValueListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.VariantAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.VariantAttributeValue.objects.select_related(
                'variant__product', 'attribute'
            )
        if self.request.user.is_staff:
            return qs
        return qs.filter(
                variant__is_active=True,
                variant__product__is_active=True,
                variant__product__status__in=[
                    models.ProductStatus.ACTIVE,
                    models.ProductStatus.OUT_OF_STOCK
                ])


class VariantAttributeValueDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.VariantAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.VariantAttributeValue.objects.select_related(
                'variant__product', 'attribute'
            )
        if self.request.user.is_staff:
            return qs
        return qs.filter(
            variant__is_active=True,
            variant__product__is_active=True,
            variant__product__status__in=[
                models.ProductStatus.ACTIVE,
                models.ProductStatus.OUT_OF_STOCK
            ])


class StockAdjustAPIView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = serializers.StockAdjustmentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        movement = services.adjust_stock(
            **serializer.validated_data
        )
        response_serializer = serializers.StockMovementSerializer(
            movement
        )
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )