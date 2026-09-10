from rest_framework import serializers

from . import models
   




class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Category
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'image',
            'is_active',
            'sort_order',
            'meta_title',
            'meta_description',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']



class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Brand
        fields = [
            'id',
            'name',
            'slug',
            'logo',
            'description',
            'is_active',
            'created_at',
            'updated_at'
        ]

        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductTypeSerializer(serializers.ModelSerializer):
    category_info = CategorySerializer(
        source='category',
        read_only=True
        )
    
    class Meta:
        model = models.ProductType
        fields = [
            'id',
            'category',
            'category_info',
            'name',
            'slug',
            'is_active',
            'sort_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']



class ProductSerializer(serializers.ModelSerializer):
    product_type_info = ProductTypeSerializer(
        source='product_type', read_only=True
    )
    brand_info = BrandSerializer(
        source='brand', read_only=True
    )
    product_type = serializers.PrimaryKeyRelatedField(
        queryset=models.ProductType.objects.filter(is_active=True)
    )
    brand = serializers.PrimaryKeyRelatedField(
        queryset=models.ProductType.objects.filter(is_active=True)
    )
    class Meta:
        model = models.Product
        fields = [
            'id',
            'product_type',
            'brand',
            'product_type_info',
            'brand_info',
            'name',
            'slug',
            'short_description',
            'description',
            'sku',
            'base_price',
            'discount_price',
            'currency',
            'status',
            'is_active',
            'is_featured',
            'warranty',
            'country_of_origin',
            'views_count',
            'created_at',
            'updated_at',
            'published_at'
        ]
        read_only_fields = ['id', 'views_count', 'created_at', 'updated_at']

    def validate(self, attrs):
        base_price = attrs.get(
            'base_price',
            getattr(self.instance, 'base_price', None)
            )
        discount_price = attrs.get(
            'discount_price',
            getattr(self.instance, 'discount_price', None)
            )

        if (
            base_price is not None and 
            discount_price is not None 
            and discount_price > base_price
            ):
            raise serializers.ValidationError({
                'discount_price':'Discount price cannot be greater than base price.'
            })


