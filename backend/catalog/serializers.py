from rest_framework import serializers
from django.utils import timezone
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
        read_only_fields = [
            'id', 
            'views_count',
            'published_at', 
            'created_at', 
            'updated_at'
            ]

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

    def create(self, validated_data):
        if validated_data.get('status') == models.ProductStatus.ACTIVE:
            validated_data['published_at'] = timezone.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        new_status = validated_data.get(
            'status', instance.status
        )
        if (
            instance.status != models.ProductStatus.ACTIVE
            and new_status == models.ProductStatus.ACTIVE
            and instance.published_at is None
        ):
            validated_data['published_at'] = timezone.now()

        return super().update(instance, validated_data)



class ProductMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Product
        fields = [
            "id",
            "name",
            "slug",
        ]



class ProductImageSerializer(serializers.ModelSerializer):
    product_info = ProductMiniSerializer(
        source="product",
        read_only=True
    )
    class Meta:
        model = models.ProductImage
        fields = [
            'id',
            'product',
            'product_info',
            'image',
            'alt_text',
            'is_primary',
            'sort_order',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        if validated_data.get("is_primary") is True:
            models.ProductImage.objects.filter(
                product=validated_data.get('product'),
                is_primary=True
            ).update(is_primary=False)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get("is_primary") is True:
            product = validated_data.get('product', instance.product)
            models.ProductImage.objects.filter(
                product=product,
                is_primary=True
            ).exclude(
                pk=instance.pk
            ).update(is_primary=False)
        return super().update(instance, validated_data)


class AttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Attribute
        fields = [
            'id',
            "name",
            "slug",
            "data_type",
            "unit"
        ]
        read_only_fields = ['id']


class ProductTypeAttributeSerializer(serializers.ModelSerializer):
    product_type = serializers.PrimaryKeyRelatedField(
        queryset=models.ProductType.objects.filter(is_active=True)
    )
    attribute_info = AttributeSerializer(
        source='attribute',
        read_only=True
    )
    product_type_info = ProductTypeSerializer(
        source='product_type',
        read_only=True
    )
    class Meta:
        model = models.ProductTypeAttribute
        fields = [
            'id',
            'product_type',
            'product_type_info',
            'attribute',
            'attribute_info',
            'is_required',
            'is_filterable',
            'sort_order'
        ]
        read_only_fields = ['id']



class ProductAttributeValueSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=models.Product.objects.filter(is_active=True)
    )
    product_info = ProductMiniSerializer(
        source="product",
        read_only=True
    )
    attribute_info = AttributeSerializer(
        source="attribute",
        read_only=True
    )
    class Meta:
        model = models.ProductAttributeValue
        fields = [
            "id",
            "product",
            "product_info",
            "attribute",
            "attribute_info",
            "value_text",
            "value_number",
            "value_boolean",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        product = attrs.get(
            'product', getattr(self.instance, 'product', None)
        )
        attribute = attrs.get(
            'attribute', getattr(self.instance, 'attribute', None)
        )

        if product is None or attribute is None:
            raise serializers.ValidationError(
                'Product and Attribute are required'
            )
        
        if product is not None and attribute is not None:
            allowed = models.ProductTypeAttribute.objects.filter(
                product_type=product.product_type,
                attribute=attribute
            ).exists()

            if not allowed:
                raise serializers.ValidationError({
                    'attribute':'This attribute is not allowed for this product type'
                })

        value_text = attrs.get(
            'value_text', getattr(self.instance, 'value_text', None)
        )
        value_number = attrs.get(
            'value_number', getattr(self.instance, 'value_number', None)
        )
        value_boolean = attrs.get(
            'value_boolean', getattr(self.instance, 'value_boolean', None)
        )

        if attribute.data_type == models.AttributeDataType.TEXT:
            if (
                value_text is None
                or value_number is not None
                or value_boolean is not None
            ):
                raise serializers.ValidationError(
                    'TEXT - it must be text only'
                )

        if attribute.data_type == models.AttributeDataType.NUMBER:
            if (
                value_number is None
                or value_text is not None
                or value_boolean is not None
            ):
                raise serializers.ValidationError(
                    'NUMBER = it must be number only'
                )

        if attribute.data_type == models.AttributeDataType.BOOLEAN:
            if (
                value_boolean is None
                or value_text is not None
                or value_number is not None
            ):
                raise serializers.ValidationError(
                    'BOOLEAN - it must be boolean only (Yes/No)'
                )
        return attrs