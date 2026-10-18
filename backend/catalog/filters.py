from django_filters import rest_framework as filters
from . import models

class ProductFilter(filters.FilterSet):
    min_price = filters.NumberFilter(
        field_name='base_price',
        lookup_expr='gte'
    )
    max_price = filters.NumberFilter(
        field_name='base_price',
        lookup_expr='lte'
    )
    brand_id = filters.ModelChoiceFilter(
        field_name='brand',
        queryset=models.Brand.objects.all()
    )
    category_id = filters.ModelChoiceFilter(
        field_name='product_type__category',
        queryset=models.Category.objects.all()
    )
    class Meta:
        model = models.Product
        fields = []