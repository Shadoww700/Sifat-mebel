from rest_framework import serializers

from .models import (
    Category,
    Brand,
    ProductType
)




class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
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
        model = Brand
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
        model = ProductType
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