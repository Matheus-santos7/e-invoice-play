"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCep, lookupCnpj } from "@/lib/fiscal-api";
import type { EmpresaFormValues } from "@/lib/empresa-form";
import type { TenantDto } from "@/lib/fiscal-types";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const CRT_OPTIONS = [
  { value: "1", label: "1 — Simples Nacional" },
  { value: "2", label: "2 — Simples (excesso sublimite)" },
  { value: "3", label: "3 — Regime Normal" },
] as const;

type FormState = EmpresaFormValues;

type Props = {
  tenant?: TenantDto;
  /** Valores restaurados após erro de validação no submit */
  draft?: EmpresaFormValues;
  fieldErrors?: Record<string, string[]>;
  idPrefix?: string;
};

function toFormState(tenant?: TenantDto, draft?: EmpresaFormValues): FormState {
  if (draft) return draft;
  return {
    razaoSocial: tenant?.razaoSocial ?? "",
    nomeFantasia: tenant?.nomeFantasia ?? "",
    cnpj: tenant?.cnpj ?? "",
    ie: tenant?.ie ?? "",
    iest: tenant?.iest ?? "",
    crt: String(tenant?.crt ?? 3),
    logradouro: tenant?.logradouro ?? "",
    numero: tenant?.numero ?? "SN",
    complemento: tenant?.complemento ?? "",
    bairro: tenant?.bairro ?? "",
    codigoMunicipio: tenant?.codigoMunicipio ?? "",
    municipio: tenant?.municipio ?? "",
    uf: tenant?.uf ?? "SP",
    cep: tenant?.cep ?? "",
    telefone: tenant?.telefone ?? "",
    ambiente: tenant?.ambiente ?? "HOMOLOGACAO",
  };
}

export function TenantFormFields({ tenant, draft, fieldErrors, idPrefix = "tenant" }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(tenant, draft));
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (draft) {
      setForm(draft);
      return;
    }
    if (tenant) setForm(toFormState(tenant));
  }, [tenant?.id, draft]);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const err = (name: keyof FormState) => fieldErrors?.[name]?.[0];

  async function onLookupCnpj() {
    setLookupError(null);
    setCnpjLoading(true);
    try {
      const data = await lookupCnpj(form.cnpj);
      let codigoMunicipio = data.codigoMunicipio || "";
      const cep = data.cep || form.cep;

      if (!codigoMunicipio && cep.replace(/\D/g, "").length === 8) {
        try {
          const viaCep = await lookupCep(cep);
          codigoMunicipio = viaCep.codigoMunicipio ?? "";
        } catch {
          // IBGE pode ser preenchido manualmente ou via Buscar CEP
        }
      }

      setForm((f) => ({
        ...f,
        razaoSocial: data.razaoSocial || f.razaoSocial,
        nomeFantasia: data.nomeFantasia || f.nomeFantasia,
        cnpj: data.cnpj,
        logradouro: data.logradouro || f.logradouro,
        numero: data.numero || f.numero,
        complemento: data.complemento ?? f.complemento,
        bairro: data.bairro || f.bairro,
        municipio: data.municipio || f.municipio,
        codigoMunicipio,
        uf: data.uf || f.uf,
        cep,
        telefone: data.telefone ?? f.telefone,
        crt: String(data.crt),
      }));
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Erro ao buscar CNPJ");
    } finally {
      setCnpjLoading(false);
    }
  }

  async function onLookupCep() {
    setLookupError(null);
    setCepLoading(true);
    try {
      const data = await lookupCep(form.cep);
      setForm((f) => ({
        ...f,
        cep: data.cep,
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        municipio: data.municipio || f.municipio,
        codigoMunicipio: data.codigoMunicipio ?? f.codigoMunicipio,
        uf: data.uf || f.uf,
      }));
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {lookupError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {lookupError}
        </div>
      )}

      <Section title="Identificação (emit)">
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor={`${idPrefix}-cnpj`}>CNPJ</Label>
            <Input
              id={`${idPrefix}-cnpj`}
              name="cnpj"
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              required
              placeholder="00.000.000/0001-00"
              className="font-mono"
            />
          </div>
          <Button type="button" variant="outline" onClick={onLookupCnpj} disabled={cnpjLoading} className="shrink-0">
            {cnpjLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            <span className="ml-2 hidden sm:inline">Buscar CNPJ</span>
          </Button>
        </div>
        <Field id={`${idPrefix}-razaoSocial`} label="Razão social (xNome)" name="razaoSocial" value={form.razaoSocial} onChange={set} required error={err("razaoSocial")} />
        <Field id={`${idPrefix}-nomeFantasia`} label="Nome fantasia (xFant)" name="nomeFantasia" value={form.nomeFantasia} onChange={set} required error={err("nomeFantasia")} />
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${idPrefix}-ie`} label="Inscrição estadual (IE)" name="ie" value={form.ie} onChange={set} required mono error={err("ie")} />
          <Field id={`${idPrefix}-iest`} label="IE substituto (IEST)" name="iest" value={form.iest} onChange={set} mono error={err("iest")} />
        </div>
        <SelectField id={`${idPrefix}-crt`} label="Regime tributário (CRT)" name="crt" value={form.crt} onChange={set} options={CRT_OPTIONS} error={err("crt")} />
      </Section>

      <Section title="Endereço (enderEmit)">
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor={`${idPrefix}-cep`}>CEP</Label>
            <Input
              id={`${idPrefix}-cep`}
              name="cep"
              value={form.cep}
              onChange={(e) => set("cep", e.target.value)}
              required
              placeholder="00000-000"
              className="font-mono"
            />
          </div>
          <Button type="button" variant="outline" onClick={onLookupCep} disabled={cepLoading} className="shrink-0">
            {cepLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            <span className="ml-2 hidden sm:inline">Buscar CEP</span>
          </Button>
        </div>
        <Field id={`${idPrefix}-logradouro`} label="Logradouro (xLgr)" name="logradouro" value={form.logradouro} onChange={set} required error={err("logradouro")} />
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${idPrefix}-numero`} label="Número (nro)" name="numero" value={form.numero} onChange={set} required error={err("numero")} />
          <Field id={`${idPrefix}-complemento`} label="Complemento (xCpl)" name="complemento" value={form.complemento} onChange={set} error={err("complemento")} />
        </div>
        <Field id={`${idPrefix}-bairro`} label="Bairro (xBairro)" name="bairro" value={form.bairro} onChange={set} required error={err("bairro")} />
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${idPrefix}-municipio`} label="Município (xMun)" name="municipio" value={form.municipio} onChange={set} required error={err("municipio")} />
          <Field
            id={`${idPrefix}-codigoMunicipio`}
            label="Cód. IBGE (cMun)"
            name="codigoMunicipio"
            value={form.codigoMunicipio}
            onChange={set}
            required
            mono
            error={err("codigoMunicipio")}
            hint="Se vazio após buscar CNPJ, clique em Buscar CEP"
          />
        </div>
        <SelectField id={`${idPrefix}-uf`} label="UF" name="uf" value={form.uf} onChange={set} options={UFS} error={err("uf")} />
      </Section>

      <Section title="Contato e ambiente">
        <Field id={`${idPrefix}-telefone`} label="Telefone (fone)" name="telefone" value={form.telefone} onChange={set} mono error={err("telefone")} />
        <SelectField
          id={`${idPrefix}-ambiente`}
          label="Ambiente SEFAZ"
          name="ambiente"
          value={form.ambiente}
          onChange={set}
          error={err("ambiente")}
          options={[
            { value: "HOMOLOGACAO", label: "Homologação" },
            { value: "PRODUCAO", label: "Produção" },
          ]}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  name,
  value,
  onChange,
  required,
  placeholder,
  mono,
  error,
  hint,
}: {
  id: string;
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (key: keyof FormState, value: string) => void;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        placeholder={placeholder}
        className={mono ? "font-mono" : undefined}
        aria-invalid={!!error}
      />
      {hint && !error && <p className="text-[12px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({
  id,
  label,
  name,
  value,
  onChange,
  options,
  error,
}: {
  id: string;
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (key: keyof FormState, value: string) => void;
  options: readonly string[] | readonly { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required
        aria-invalid={!!error}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map((opt) =>
          typeof opt === "string" ? (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ) : (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ),
        )}
      </select>
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
