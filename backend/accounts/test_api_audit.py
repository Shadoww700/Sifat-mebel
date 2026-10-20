"""Authentication, ownership and role regressions using the existing API contract."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Address, EmailVerificationCode, VerificationPurpose
from accounts.services import create_verification_code


API = "/api/v1/"
PASSWORD = "Audit-Original-Strong!247"
NEW_PASSWORD = "Audit-Replaced-Strong!593"


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthenticationAuditTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            email="verified@audit.test", password=PASSWORD, is_email_verified=True,
        )

    def login(self, **overrides):
        return self.client.post(API + "auth/login/", {
            "email": self.user.email, "password": PASSWORD, **overrides,
        }, format="json")

    def test_registration_hashes_password_and_cannot_assign_admin_or_verified_status(self):
        response = self.client.post(API + "auth/register/", {
            "email": "new@audit.test", "password": PASSWORD, "password_confirm": PASSWORD,
            "role": "ADMIN", "is_staff": True, "is_superuser": True, "is_email_verified": True,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        user = get_user_model().objects.get(email="new@audit.test")
        self.assertTrue(user.check_password(PASSWORD))
        self.assertNotEqual(user.password, PASSWORD)
        self.assertEqual(user.role, "USER")
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_email_verified)
        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)
        self.assertTrue(hasattr(user, "profile"))
        self.assertEqual(len(mail.outbox), 1)
        code = EmailVerificationCode.objects.get(user=user)
        self.assertEqual(code.purpose, VerificationPurpose.EMAIL_VERIFY)
        self.assertFalse(code.is_used)

    def test_registration_rejects_duplicate_email_weak_and_mismatched_passwords(self):
        for changes in ({"email": self.user.email}, {"password": "123", "password_confirm": "123"},
                        {"password_confirm": "different"}):
            response = self.client.post(API + "auth/register/", {
                "email": "new@audit.test", "password": PASSWORD, "password_confirm": PASSWORD, **changes,
            }, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertFalse(EmailVerificationCode.objects.exists())

    def test_jwt_login_me_and_refresh_use_real_authentication(self):
        response = self.login()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["user"]["id"], self.user.pk)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        me = self.client.get(API + "auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual((me.data["id"], me.data["role"]), (self.user.pk, "USER"))
        self.assertNotIn("password", me.data)
        self.client.credentials()
        refresh = self.client.post(API + "auth/token/refresh/", {"refresh": response.data["refresh"]}, format="json")
        self.assertEqual(refresh.status_code, 200, refresh.data)
        self.assertIn("access", refresh.data)

    def test_login_rejects_wrong_password_unknown_unverified_and_inactive_users(self):
        for changes in ({"password": "wrong"}, {"email": "missing@audit.test"}):
            self.assertEqual(self.login(**changes).status_code, 400)
        get_user_model().objects.filter(pk=self.user.pk).update(is_email_verified=False)
        self.assertEqual(self.login().status_code, 400)
        get_user_model().objects.filter(pk=self.user.pk).update(is_email_verified=True, is_active=False)
        self.assertEqual(self.login().status_code, 400)

    def test_inactive_user_cannot_use_previously_issued_access_token(self):
        token = RefreshToken.for_user(self.user).access_token
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(API + "auth/me/").status_code, 401)

    def test_logout_blacklists_refresh_and_rejects_reuse(self):
        token = str(RefreshToken.for_user(self.user))
        response = self.client.post(API + "auth/logout/", {"refresh": token}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(BlacklistedToken.objects.count(), 1)
        self.assertEqual(self.client.post(API + "auth/token/refresh/", {"refresh": token}, format="json").status_code, 401)
        self.assertEqual(self.client.post(API + "auth/logout/", {"refresh": token}, format="json").status_code, 400)

    def test_logout_all_blacklists_only_current_users_refresh_tokens(self):
        own_tokens = [str(RefreshToken.for_user(self.user)) for _ in range(2)]
        other = get_user_model().objects.create_user(email="other@audit.test", is_email_verified=True)
        foreign = str(RefreshToken.for_user(other))
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post(API + "auth/logout-all/").status_code, 200)
        self.client.force_authenticate(user=None)
        for token in own_tokens:
            self.assertEqual(self.client.post(API + "auth/token/refresh/", {"refresh": token}, format="json").status_code, 401)
        self.assertEqual(self.client.post(API + "auth/token/refresh/", {"refresh": foreign}, format="json").status_code, 200)

    def test_email_verification_code_is_hashed_single_use_and_changes_user(self):
        self.user.is_email_verified = False
        self.user.save(update_fields=["is_email_verified"])
        raw = create_verification_code(self.user)
        code = EmailVerificationCode.objects.get(user=self.user)
        self.assertNotEqual(raw, code.code_hash)
        self.assertTrue(check_password(raw, code.code_hash))
        response = self.client.post(API + "auth/email-verify/", {"email": self.user.email, "code": raw}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        code.refresh_from_db()
        self.assertTrue(self.user.is_email_verified)
        self.assertTrue(code.is_used)
        self.assertEqual(self.client.post(API + "auth/email-verify/", {
            "email": self.user.email, "code": raw,
        }, format="json").status_code, 400)

    def test_wrong_email_code_increments_attempts_and_five_attempts_block_valid_code(self):
        raw = create_verification_code(self.user)
        wrong = "000000" if raw != "000000" else "111111"
        for attempt in range(1, 6):
            response = self.client.post(API + "auth/email-verify/", {"email": self.user.email, "code": wrong}, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(EmailVerificationCode.objects.get(user=self.user).attempts, attempt)
        self.assertEqual(self.client.post(API + "auth/email-verify/", {
            "email": self.user.email, "code": raw,
        }, format="json").status_code, 400)
        self.assertFalse(EmailVerificationCode.objects.get(user=self.user).is_used)

    def test_expired_email_code_cannot_verify_user(self):
        get_user_model().objects.filter(pk=self.user.pk).update(is_email_verified=False)
        raw = create_verification_code(self.user)
        EmailVerificationCode.objects.filter(user=self.user).update(expires_at=timezone.now() - timedelta(seconds=1))
        response = self.client.post(API + "auth/email-verify/", {"email": self.user.email, "code": raw}, format="json")
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_email_verified)

    def test_resend_invalidates_old_code_but_not_other_purpose(self):
        get_user_model().objects.filter(pk=self.user.pk).update(is_email_verified=False)
        create_verification_code(self.user)
        old = EmailVerificationCode.objects.get(user=self.user)
        create_verification_code(self.user, VerificationPurpose.PASSWORD_RESET)
        response = self.client.post(API + "auth/resend-verification/", {"email": self.user.email}, format="json")
        self.assertEqual(response.status_code, 200)
        old.refresh_from_db()
        self.assertTrue(old.is_used)
        self.assertEqual(EmailVerificationCode.objects.filter(user=self.user, is_used=False).count(), 2)
        self.assertEqual(len(mail.outbox), 1)

    def test_password_forgot_does_not_expose_account_existence_in_response(self):
        existing = self.client.post(API + "auth/password/forgot/", {"email": self.user.email}, format="json")
        missing = self.client.post(API + "auth/password/forgot/", {"email": "missing@audit.test"}, format="json")
        self.assertEqual(existing.status_code, 200)
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(existing.data, missing.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(EmailVerificationCode.objects.get(user=self.user).purpose, VerificationPurpose.PASSWORD_RESET)

    def test_password_reset_changes_hash_consumes_code_and_revokes_refresh(self):
        old_refresh = str(RefreshToken.for_user(self.user))
        raw = create_verification_code(self.user, VerificationPurpose.PASSWORD_RESET)
        payload = {"email": self.user.email, "code": raw,
                   "new_password": NEW_PASSWORD, "new_password_confirm": NEW_PASSWORD}
        response = self.client.post(API + "auth/password/reset/", payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        self.assertFalse(self.user.check_password(PASSWORD))
        self.assertTrue(EmailVerificationCode.objects.get(user=self.user).is_used)
        self.assertEqual(self.client.post(API + "auth/token/refresh/", {"refresh": old_refresh}, format="json").status_code, 401)
        self.assertEqual(self.client.post(API + "auth/password/reset/", payload, format="json").status_code, 400)

    def test_email_verification_code_cannot_be_used_for_password_reset(self):
        raw = create_verification_code(self.user, VerificationPurpose.EMAIL_VERIFY)
        response = self.client.post(API + "auth/password/reset/", {
            "email": self.user.email, "code": raw,
            "new_password": NEW_PASSWORD, "new_password_confirm": NEW_PASSWORD,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_change_password_accepts_a_password_not_only_email_shaped_text(self):
        # Regression: current_password is currently declared as EmailField.
        self.client.force_authenticate(user=self.user)
        refresh = str(RefreshToken.for_user(self.user))
        response = self.client.post(API + "auth/change/password/", {
            "current_password": PASSWORD, "new_password": NEW_PASSWORD,
            "new_password_confirm": NEW_PASSWORD,
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(API + "auth/token/refresh/", {"refresh": refresh}, format="json").status_code, 401)


class AccountOwnershipAuditTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(email="owner@audit.test")
        cls.other = get_user_model().objects.create_user(email="other@audit.test")
        cls.address = Address.objects.create(user=cls.other, **cls.address_payload())

    @staticmethod
    def address_payload(**overrides):
        return {"title": "Дом", "recipient_name": "Покупатель", "phone_number": "777774104",
                "country": "Таджикистан", "region": "Душанбе", "city": "Душанбе",
                "street": "Тестовая", "house": "1", **overrides}

    def test_guest_denied_on_every_protected_account_endpoint(self):
        for method, path in (("get", "auth/me/"), ("get", "profile/"), ("patch", "profile/"),
                             ("get", "profile/addresses/"), ("post", "profile/addresses/"),
                             ("patch", f"profile/addresses/{self.address.pk}/"),
                             ("delete", f"profile/addresses/{self.address.pk}/"),
                             ("post", "auth/logout-all/"), ("post", "auth/change/password/")):
            response = getattr(self.client, method)(API + path, {}, format="json")
            self.assertEqual(response.status_code, 401, (method, path))

    def test_profile_can_edit_own_fields_but_not_role_email_verification_or_another_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(API + "profile/", {
            "first_name": "Моё имя", "phone_number": "777774104", "birth_date": "1990-01-01",
            "email": self.other.email, "role": "ADMIN", "is_staff": True,
            "is_email_verified": True, "user": self.other.pk,
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual((self.user.email, self.user.role, self.user.first_name), ("owner@audit.test", "USER", "Моё имя"))
        self.assertFalse(self.user.is_staff)
        self.assertFalse(self.user.is_email_verified)
        self.assertEqual(self.other.first_name, "")
        self.assertEqual(self.client.get(API + "profile/").data["birth_date"], "1990-01-01")

    def test_address_hidden_user_is_current_user_and_default_is_unique_per_owner(self):
        self.client.force_authenticate(user=self.user)
        first = self.client.post(API + "profile/addresses/", self.address_payload(user=self.other.pk, is_default=True), format="json")
        second = self.client.post(API + "profile/addresses/", self.address_payload(title="Работа", is_default=True), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        a = Address.objects.get(pk=first.data["id"])
        b = Address.objects.get(pk=second.data["id"])
        self.assertEqual(a.user_id, self.user.pk)
        self.assertFalse(a.is_default)
        self.assertTrue(b.is_default)
        response = self.client.patch(API + f"profile/addresses/{a.pk}/", {"is_default": True}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Address.objects.filter(user=self.user, is_default=True).get().pk, a.pk)
        own = self.client.get(API + "profile/addresses/")
        self.assertEqual(own.status_code, 200)
        self.assertCountEqual([row["id"] for row in own.data], [a.pk, b.pk])
        self.assertEqual(self.client.delete(API + f"profile/addresses/{a.pk}/").status_code, 204)
        self.assertFalse(Address.objects.filter(pk=a.pk).exists())

    def test_address_queryset_prevents_foreign_patch_and_delete(self):
        self.client.force_authenticate(user=self.user)
        for method, payload in (("patch", {"title": "Stolen"}), ("delete", {})):
            self.assertEqual(getattr(self.client, method)(API + f"profile/addresses/{self.address.pk}/", payload, format="json").status_code, 404)
        self.address.refresh_from_db()
        self.assertEqual(self.address.title, "Дом")

    def test_address_detail_get_is_not_part_of_the_current_contract(self):
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(API + f"profile/addresses/{self.address.pk}/").status_code, 405)
