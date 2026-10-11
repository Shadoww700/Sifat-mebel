from rest_framework.permissions import BasePermission, SAFE_METHODS
from accounts.models import UserRole

def is_admin(user):
    return (
        user.is_authenticated
        and (
            user.role == UserRole.ADMIN
            or user.is_staff
        ))

class IsAdminOrReadonly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return is_admin(request.user)

class IsAdminOnly(BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)