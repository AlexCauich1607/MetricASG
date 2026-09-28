from app.controllers.base_controller import BaseController
from app.models.ambit_model import Ambit
from app.services.methodology_catalog_service import MethodologyCatalogService

class AmbitsController(BaseController):
    model = Ambit
    prefix = "ambits"
    create_only_admin = True
    update_only_admin = True
    delete_only_admin = True
    service_class = MethodologyCatalogService
