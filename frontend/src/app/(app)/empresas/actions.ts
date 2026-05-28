"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type EmpresaFormState,
  formatFieldErrors,
  inputToFormValues,
} from "@/lib/empresa-form";
import { ApiValidationError, createTenant, deleteTenant, lookupCep, updateTenant } from "@/lib/fiscal-api";
import type { EnvironmentType, TenantInput } from "@/lib/fiscal-types";

function parseForm(formData: FormData): TenantInput {
  const opt = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 ? v : undefined;
  };

  return {
    razaoSocial: String(formData.get("razaoSocial") ?? "").trim(),
    nomeFantasia: String(formData.get("nomeFantasia") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim(),
    ie: String(formData.get("ie") ?? "").trim(),
    iest: opt("iest"),
    crt: Number(formData.get("crt") ?? 3),
    logradouro: String(formData.get("logradouro") ?? "").trim(),
    numero: String(formData.get("numero") ?? "SN").trim(),
    complemento: opt("complemento"),
    bairro: String(formData.get("bairro") ?? "").trim(),
    codigoMunicipio: String(formData.get("codigoMunicipio") ?? "").replace(/\D/g, ""),
    municipio: String(formData.get("municipio") ?? "").trim(),
    uf: String(formData.get("uf") ?? "").trim().toUpperCase(),
    cep: String(formData.get("cep") ?? "").replace(/\D/g, ""),
    codigoPais: 1058,
    nomePais: "Brasil",
    telefone: opt("telefone"),
    ambiente: String(formData.get("ambiente") ?? "HOMOLOGACAO") as EnvironmentType,
  };
}

async function enrichFromCep(input: TenantInput): Promise<TenantInput> {
  if (input.codigoMunicipio.length === 7 || input.cep.length !== 8) return input;

  try {
    const viaCep = await lookupCep(input.cep);
    return {
      ...input,
      codigoMunicipio: viaCep.codigoMunicipio ?? input.codigoMunicipio,
      logradouro: input.logradouro || viaCep.logradouro,
      bairro: input.bairro || viaCep.bairro,
      municipio: input.municipio || viaCep.municipio,
      uf: input.uf || viaCep.uf,
    };
  } catch {
    return input;
  }
}

function failureState(e: unknown, values: ReturnType<typeof inputToFormValues>): EmpresaFormState {
  const fieldErrors = e instanceof ApiValidationError ? e.fieldErrors : undefined;
  return {
    error: formatFieldErrors(fieldErrors) ?? (e instanceof Error ? e.message : "Erro ao salvar empresa"),
    fieldErrors,
    values,
  };
}

export async function createEmpresaAction(
  _prev: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  const parsed = parseForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await createTenant(await enrichFromCep(parsed));
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/empresas");
  revalidatePath("/");
  redirect("/empresas");
}

export async function updateEmpresaModalAction(
  id: string,
  _prev: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  const parsed = parseForm(formData);
  const values = inputToFormValues(parsed);
  try {
    await updateTenant(id, await enrichFromCep(parsed));
  } catch (e) {
    return failureState(e, values);
  }
  revalidatePath("/empresas");
  revalidatePath("/");
  return { success: true };
}

export async function deleteEmpresaAction(id: string): Promise<EmpresaFormState> {
  try {
    await deleteTenant(id);
    revalidatePath("/empresas");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir empresa" };
  }
}
