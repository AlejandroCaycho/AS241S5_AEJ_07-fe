import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiError } from '../../models/api-error.model';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const apiError: ApiError = {
        status: error.status,
        message: getErrorMessage(error),
        detail: error.error,
      };

      return throwError(() => apiError);
    }),
  );

function getErrorMessage(error: HttpErrorResponse): string {
  if (error.error?.message) {
    return error.error.message;
  }

  if (typeof error.error === 'string' && error.error.trim().length > 0) {
    return error.error;
  }

  if (error.status === 0) {
    return 'No se pudo conectar con la API. Verifica que el backend este activo.';
  }

  return error.message || 'Ocurrio un error al consumir la API.';
}
