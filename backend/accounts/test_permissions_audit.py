"""DB-free permission and serializer regressions runnable before PostgreSQL is ready."""

from types import SimpleNamespace

from django.contrib.auth.models import AnonymousUser
from django.test import SimpleTestCase
from rest_framework import serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.test import APIClient

from accounts.permissions import IsAdminOnly, IsAdminOrReadonly, IsOwner, is_admin
from accounts.serializers import ChangePasswordSerializer


class PermissionUnitAuditTests(SimpleTestCase):
    def test_admin_helper_handles_guest_user_manager_role_admin_and_staff(self):
        self.assertFalse(is_admin(AnonymousUser()))
        for role, staff, expected in (("USER", False, False), ("MANAGER", False, False),
                                       ("ADMIN", False, True), ("USER", True, True)):
            with self.subTest(role=role, staff=staff):
                user = SimpleNamespace(is_authenticated=True, role=role, is_staff=staff)
                self.assertEqual(is_admin(user), expected)
                request = SimpleNamespace(method="POST", user=user)
                self.assertEqual(IsAdminOnly().has_permission(request, None), expected)
                self.assertEqual(IsAdminOrReadonly().has_permission(request, None), expected)

    def test_safe_methods_are_public_and_unsafe_methods_reject_anonymous(self):
        for method in ("GET", "HEAD", "OPTIONS"):
            request = SimpleNamespace(method=method, user=AnonymousUser())
            self.assertTrue(IsAdminOrReadonly().has_permission(request, None))
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            request = SimpleNamespace(method=method, user=AnonymousUser())
            self.assertFalse(IsAdminOrReadonly().has_permission(request, None))
            self.assertFalse(IsAdminOnly().has_permission(request, None))

    def test_owner_permission_checks_object_user_not_role(self):
        owner = SimpleNamespace(pk=1)
        other = SimpleNamespace(pk=2)
        obj = SimpleNamespace(user=owner)
        self.assertTrue(IsOwner().has_object_permission(SimpleNamespace(user=owner), None, obj))
        self.assertFalse(IsOwner().has_object_permission(SimpleNamespace(user=other), None, obj))

    def test_builtin_staff_permission_and_project_admin_role_disagree(self):
        # Exposes the actual conflict without redefining the warehouse policy in a mock.
        request = SimpleNamespace(user=SimpleNamespace(is_authenticated=True, role="ADMIN", is_staff=False))
        self.assertTrue(IsAdminOnly().has_permission(request, None))
        self.assertFalse(IsAdminUser().has_permission(request, None))

    def test_change_password_current_password_field_must_accept_non_email_passwords(self):
        field = ChangePasswordSerializer().fields["current_password"]
        # Deliberate regression: a normal password must survive field-level validation.
        try:
            value = field.run_validation("Normal-Strong-Password!742")
        except serializers.ValidationError as error:
            self.fail(f"current_password rejects a normal password: {error.detail}")
        self.assertEqual(value, "Normal-Strong-Password!742")

    def test_guest_me_and_malformed_jwt_are_rejected_without_database_access(self):
        client = APIClient()
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 401)
        client.credentials(HTTP_AUTHORIZATION="Bearer invalid.token.signature")
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 401)
