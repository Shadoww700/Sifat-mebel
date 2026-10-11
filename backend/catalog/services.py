from django.db import transaction
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404

from .models import ProductVariant, StockMovement, StockMovementChoices

def adjust_stock(*, variant_id, operation, quantity, reason=''):
    if quantity <= 0:
        raise ValidationError('Quantity must be greater than 0 (zero)')
    
    if operation not in StockMovementChoices.values:
        raise ValidationError('Invalid stock operation')
    
    with transaction.atomic():
        variant = get_object_or_404(
            ProductVariant.objects.select_for_update(),
            pk=variant_id,
        )
        if operation == StockMovementChoices.IN:
            variant.stock_quantity += quantity

        elif operation == StockMovementChoices.OUT:
            if variant.stock_quantity < quantity:
                raise ValidationError('Insufficient stock')
            variant.stock_quantity -= quantity

        variant.save(update_fields=['stock_quantity'])
        movement = StockMovement.objects.create(
            variant=variant,
            operation=operation,
            quantity=quantity,
            reason=reason
        )
        return movement