from django.core.validators import MinValueValidator
from decimal import Decimal
from django.db import models
from .managers import (
    CategoryManager,

)



class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='category/images', blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CategoryManager()

    def __str__(self):
        return self.name


class Brand(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to='brand/logos',blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ProductType(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='product_types'
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField()
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'slug'],
                name='unique_product_type_slug_per_category'
            )
        ]
    def __str__(self):
        return self.name


class ProductStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'DRAFT'
    ACTIVE = 'ACTIVE', 'ACTIVE'
    OUT_OF_STOCK = 'OUT_OF_STOCK', 'OUT_OF_STOCK'
    ARCHIVED = 'ARCHIVED', 'ARCHIVED'

class Currency(models.TextChoices):
    TJS = 'TJS', 'TJS'
    USD = 'USD', 'USD'

class Product(models.Model):
    product_type = models.ForeignKey(
        ProductType,
        on_delete=models.PROTECT,
        related_name='products'
    )
    brand = models.ForeignKey(
        Brand,
        on_delete=models.PROTECT,
        related_name='products'
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    short_description = models.CharField(max_length=150)
    description = models.TextField()
    sku = models.CharField(max_length=255, unique=True)
    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
        )
    discount_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
        )
    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.TJS
    )
    status = models.CharField(
        max_length=20,
        choices=ProductStatus.choices,
        default=ProductStatus.DRAFT
        )
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    warranty = models.CharField(max_length=100, blank=True)
    country_of_origin = models.CharField(max_length=100, blank=True)
    views_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(base_price__gte=0) &
                    (models.Q(discount_price__isnull=True)|(models.Q(discount_price__gte=0)&
                    models.Q(discount_price__lte=models.F("base_price"))))
                ), name='product_valid_prices')]

    def archive(self):
        self.is_active = False
        self.status=ProductStatus.ARCHIVED
        self.save(update_fields=['is_active', 'status'])

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image = models.ImageField(upload_to='products/images/')
    alt_text = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product"],
                condition=models.Q(is_primary=True),
                name="one_primary_image_per_product",
            )]

    def __str__(self):
        return f'{self.product.name} image'



class AttributeDataType(models.TextChoices):
    TEXT = 'TEXT', 'TEXT'
    NUMBER = 'NUMBER', 'NUMBER'
    BOOLEAN = 'BOOLEAN', 'BOOLEAN'


class Attribute(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    data_type = models.CharField(
        max_length=20, choices=AttributeDataType.choices,
        default=AttributeDataType.TEXT
        )
    unit = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return '{self.name} Attribute'



class ProductTypeAttribute(models.Model):
    product_type = models.ForeignKey(
        ProductType,
        on_delete=models.PROTECT,
        related_name='attribute_links'
    )
    attribute = models.ForeignKey(
        Attribute,
        on_delete=models.PROTECT,
        related_name='product_type_links'
    )
    is_required = models.BooleanField(default=False)
    is_filterable = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)


    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['product_type', 'attribute'],
                name='unique_attribute_per_product_type'
            )]

    def __str__(self):
        return f'{self.product_type} - {self.attribute}'



class ProductAttributeValue(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="attribute_values"
    )
    attribute = models.ForeignKey(
        Attribute,
        on_delete=models.PROTECT,
        related_name="product_values"
    )
    value_text = models.CharField(max_length=255, null=True, blank=True)
    value_number = models.DecimalField(max_digits=12, decimal_places=2, null=True,blank=True)
    value_boolean = models.BooleanField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product", "attribute"],
                name="product_attribute_unique"
            )]

    def __str__(self):
        return f"{self.product} - {self.attribute}"



class ProductVariant(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='variants'
    )
    sku = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
        )
    discount_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
        )
    stock_quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=0),
                name='variant_price_non_negative'
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(discount_price__isnull=True)|(models.Q(discount_price__gte=0) &
                    models.Q(discount_price__lte=models.F('price'))
                    )), name='variant_valid_discount_price')]