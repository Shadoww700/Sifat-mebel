from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from accounts.permissions import (
    IsAdminOrReadonly,
    IsAdminOnly,
    is_admin,
    IsOwner
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Prefetch
    
from . import serializers, models, services
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .filters import ProductFilter
from .pagination import ProductPagination
from .visibility import public_product


class CategoryListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.CategorySerializer

    def get_queryset(self):
        if not is_admin(self.request.user):
            return models.Category.objects.active().ordered()
        return models.Category.objects.ordered()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminOnly()]


class CategoryDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.CategorySerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if not is_admin(self.request.user):
            return models.Category.objects.active()
        return models.Category.objects.all()


class BrandListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.BrandSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if is_admin(self.request.user):
            return models.Brand.objects.all().order_by('id')
        return models.Brand.objects.filter(
            is_active=True
        ).order_by('id')


class BrandDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.BrandSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if is_admin(self.request.user):
            return models.Brand.objects.all()
        return models.Brand.objects.filter(is_active=True)


class ProductTypeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductTypeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductType.objects.select_related('category')
        if is_admin(self.request.user):
            return qs  
                
        return qs.filter(is_active=True, category__is_active=True)


class ProductTypeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductTypeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductType.objects.select_related('category')
        if is_admin(self.request.user):
            return qs  
        
        return qs.filter(is_active=True, category__is_active=True)


class ProductListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductSerializer
    permission_classes = [IsAdminOrReadonly]
    pagination_class = ProductPagination
    filter_backends = [
        SearchFilter, 
        OrderingFilter,
        DjangoFilterBackend
        ]
    filterset_class = ProductFilter
    search_fields = [
        'name', 
        'short_description',
        'brand__name',
        'product_type__name'
    ]
    ordering_fields = [
        'base_price', 
        'created_at'
    ]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = models.Product.objects.select_related('brand', 'product_type__category')

        if not is_admin(self.request.user):
            qs = qs.filter(public_product())
        return qs 


class ProductDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        variant_qs = models.ProductVariant.objects.all()

        if not is_admin(self.request.user):
            variant_qs = variant_qs.filter(is_active=True)

        qs = models.Product.objects.select_related(
            'brand',
            'product_type__category'
            ).prefetch_related(
                'images',
                Prefetch('attribute_values', queryset=models.ProductAttributeValue.objects.select_related('attribute')),
                Prefetch(
                'variants',
                queryset=variant_qs.prefetch_related(Prefetch(
                    'attribute_values',
                    queryset=models.VariantAttributeValue.objects.select_related('attribute'),
                ))
                ))
        if is_admin(self.request.user):
            return qs
        
        return qs.filter(public_product())
    def get_serializer_class(self):
        if self.request.method == 'GET':
            return serializers.ProductDetailSerializer
        return serializers.ProductSerializer

    def perform_destroy(self, instance):
        instance.archive()



class ProductImageListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductImageSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductImage.objects.select_related('product')
        if not is_admin(self.request.user):
            qs = qs.filter(public_product('product__'))
        # Treat an explicitly empty filter as invalid, not an omitted HTML field.
        query = serializers.ProductImageQuerySerializer(data=self.request.query_params.dict())
        query.is_valid(raise_exception=True)
        if 'product_ids' in query.validated_data:
            qs = qs.filter(product_id__in=query.validated_data['product_ids'])
        if 'product_id' in query.validated_data:
            qs = qs.filter(product_id=query.validated_data['product_id'])
        return qs.order_by('product_id', '-is_primary', 'sort_order', 'id')


class ProductImageDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductImageSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductImage.objects.select_related('product')
        if is_admin(self.request.user):
            return qs
        
        return qs.filter(public_product('product__'))


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

        if is_admin(self.request.user):
            return qs
        return qs.filter(
            product_type__is_active=True,
            product_type__category__is_active=True,
        )


class ProductTypeAttributeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductTypeAttributeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductTypeAttribute.objects.select_related(
            'product_type__category', 'attribute'
        ).order_by('sort_order', 'id')
    
        if is_admin(self.request.user):
            return qs
        return qs.filter(
            product_type__is_active=True,
            product_type__category__is_active=True,
        )


class ProductAttributeValueListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductAttributeValue.objects.select_related(
            'product', 'attribute'
        )

        if is_admin(self.request.user):
            return qs
        return qs.filter(public_product('product__'))


class ProductAttributeValueDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductAttributeValue.objects.select_related(
            'product', 'attribute'
        )

        if is_admin(self.request.user):
            return qs
        return qs.filter(public_product('product__'))


class ProductVariantListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.ProductVariantSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductVariant.objects.select_related('product')
        if is_admin(self.request.user):
            return qs
        
        return qs.filter(public_product('product__'), is_active=True)

class ProductVariantDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.ProductVariantSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.ProductVariant.objects.select_related('product')
        if is_admin(self.request.user):
            return qs
            
        return qs.filter(public_product('product__'), is_active=True)
    def perform_destroy(self, instance):
        instance.is_active=False
        instance.save(update_fields=['is_active', 'updated_at'])


class VariantAttributeValueListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.VariantAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.VariantAttributeValue.objects.select_related(
                'variant__product', 'attribute'
            )
        if is_admin(self.request.user):
            return qs
        return qs.filter(public_product('variant__product__'), variant__is_active=True)


class VariantAttributeValueDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.VariantAttributeValueSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = models.VariantAttributeValue.objects.select_related(
                'variant__product', 'attribute'
            )
        if is_admin(self.request.user):
            return qs
        return qs.filter(public_product('variant__product__'), variant__is_active=True)


class StockAdjustAPIView(APIView):
    # Use the same existing project policy as products and stock history.
    permission_classes = [IsAdminOnly]

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


class StockMovementListAPIView(generics.ListAPIView):
    serializer_class = serializers.StockMovementSerializer
    permission_classes = [IsAdminOnly]

    def get_queryset(self):
        qs = models.StockMovement.objects.select_related("variant")

        variant_id = self.request.query_params.get("variant_id")

        if variant_id is not None:
            query = serializers.StockMovementQuerySerializer(data={'variant_id': variant_id})
            query.is_valid(raise_exception=True)
            qs = qs.filter(variant_id=query.validated_data['variant_id'])

        return qs


class FavoriteListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = serializers.FavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return models.Favorite.objects.filter(
            user=self.request.user
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        favorite, created = models.Favorite.objects.get_or_create(
            user=request.user,
            product=serializer.validated_data['product']
        )

        result = self.get_serializer(favorite)

        return Response(
            result.data,
            status=201 if created else 200
        )

class FavoriteDeleteAPIView(generics.RetrieveDestroyAPIView):
    serializer_class = serializers.FavoriteSerializer
    permission_classes = [IsOwner, IsAuthenticated]

    def get_queryset(self):
        return models.Favorite.objects.filter(
            user=self.request.user
        )
